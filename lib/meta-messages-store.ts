// Persistencia de mensajes de Messenger e Instagram (recibidos y enviados).
// Mismo patrón que wa-store: Supabase si hay credenciales (tabla meta_messages,
// ver supabase/meta-messages.sql) y un store EN MEMORIA como fallback. Si el
// insert/select en Supabase falla (p. ej. la tabla aún no existe), cae a
// memoria para que el flujo no se rompa en dev.
//
// Cada mensaje lleva tenant (lo resuelve el webhook por page_id/ig_id) y un
// `mid` (id del mensaje en Meta) que sirve de dedup: Meta reintenta webhooks y
// el upsert por mid evita duplicados.

import { getSupabase } from "./supabase";

export type MetaCanal = "facebook" | "instagram";
export type MetaDireccion = "in" | "out"; // in = del cliente, out = de la empresa

export interface MetaMensaje {
  seq: number; // cursor monotónico (id de la fila, o contador en memoria)
  mid: string; // id del mensaje en Meta (dedup)
  tenant: string;
  canal: MetaCanal;
  pageId: string; // página de FB dueña de la conversación (IG también envía por ella)
  senderId: string; // PSID (Messenger) o IGSID (Instagram): clave de la conversación
  senderName?: string;
  texto: string;
  ts: string; // ISO 8601
  direction: MetaDireccion;
}

// Fallback en memoria, anclado en globalThis: en dev cada ruta compila su
// propia instancia del módulo y un array a nivel de módulo NO se comparte
// entre el webhook y el inbox (además el HMR lo borraría).
const g = globalThis as unknown as {
  __metaMensajes?: { rows: MetaMensaje[]; seq: number };
};
const mem = (g.__metaMensajes ??= { rows: [], seq: 0 });
const MAX = 500;

function guardarEnMemoria(m: Omit<MetaMensaje, "seq">): void {
  if (mem.rows.some((x) => x.mid === m.mid)) return; // dedup
  mem.rows.push({ ...m, seq: ++mem.seq });
  if (mem.rows.length > MAX) mem.rows.splice(0, mem.rows.length - MAX);
}

async function guardar(m: Omit<MetaMensaje, "seq">): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("meta_messages").upsert(
      {
        mid: m.mid,
        tenant: m.tenant,
        canal: m.canal,
        page_id: m.pageId,
        sender_id: m.senderId,
        sender_name: m.senderName ?? null,
        texto: m.texto,
        ts: m.ts,
        direction: m.direction,
      },
      { onConflict: "mid", ignoreDuplicates: true },
    );
    if (!error) return;
    console.error("[meta-messages] insert falló, cae a memoria:", error.message);
  }
  guardarEnMemoria(m);
}

// Mensaje recibido del cliente (webhook).
export async function addMetaInbound(
  m: Omit<MetaMensaje, "seq" | "direction">,
): Promise<void> {
  return guardar({ ...m, direction: "in" });
}

// Mensaje que la empresa envió (para que persista la conversación).
export async function addMetaOutbound(
  m: Omit<MetaMensaje, "seq" | "direction">,
): Promise<void> {
  return guardar({ ...m, direction: "out" });
}

// Devuelve los mensajes con cursor (seq/id) mayor al del cliente. Si se pasa
// `tenant`, solo los de ese cliente (así cada dashboard ve lo suyo).
export async function getMetaSince(after: number, tenant?: string): Promise<MetaMensaje[]> {
  const sb = getSupabase();
  if (sb) {
    let q = sb
      .from("meta_messages")
      .select("id, mid, tenant, canal, page_id, sender_id, sender_name, texto, ts, direction")
      .gt("id", after);
    if (tenant) q = q.eq("tenant", tenant);
    const { data, error } = await q.order("id", { ascending: true }).limit(100);
    if (!error) {
      return (data ?? []).map((r) => ({
        seq: Number(r.id),
        mid: (r.mid as string | null) ?? `meta-fila-${r.id}`,
        tenant: r.tenant as string,
        canal: (r.canal as MetaCanal) ?? "facebook",
        pageId: r.page_id as string,
        senderId: r.sender_id as string,
        senderName: (r.sender_name as string | null) ?? undefined,
        texto: r.texto as string,
        ts: r.ts as string,
        direction: ((r.direction as string | null) ?? "in") as MetaDireccion,
      }));
    }
    console.error("[meta-messages] select falló, cae a memoria:", error.message);
  }
  return mem.rows.filter((m) => m.seq > after && (!tenant || m.tenant === tenant));
}
