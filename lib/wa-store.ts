// Persistencia de mensajes de WhatsApp (recibidos y enviados).
// Si hay Supabase configurado, guarda/lee de la tabla `wa_messages` (persiste,
// sobrevive reinicios, sirve desplegado). Si no, cae a un store EN MEMORIA.
//
// Cada mensaje lleva un `tenant` (hospital | grupoq): como hay UN solo número en
// vivo, un switch global decide a qué cliente entran los mensajes. Así cada
// dashboard filtra y muestra solo lo suyo, y la IA usa el guion de ese cliente.
import { getSupabase } from "./supabase";

export type Direccion = "in" | "out"; // in = del cliente, out = de la empresa

export interface WaMedia {
  id: string; // media_id de Meta (para descargar el archivo por el proxy)
  tipo: string; // image | document | audio | sticker | video
  mime?: string;
  filename?: string;
}

export interface WaInbound {
  seq: number; // cursor monotónico (id de la fila, o contador en memoria)
  waId: string; // id del mensaje en WhatsApp (dedup)
  from: string; // número del cliente (clave de la conversación)
  nombre?: string;
  texto: string;
  ts: string; // ISO 8601
  direccion: Direccion;
  tenant?: string; // cliente al que entró el número en vivo (hospital | grupoq)
  media?: WaMedia;
}

// Fallback en memoria.
const mem: WaInbound[] = [];
let memSeq = 0;
const MAX = 500;

async function guardar(m: Omit<WaInbound, "seq">): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("wa_messages").upsert(
      {
        wa_id: m.waId,
        wa_from: m.from,
        nombre: m.nombre ?? null,
        texto: m.texto,
        ts: m.ts,
        direccion: m.direccion,
        tenant: m.tenant ?? "hospital",
        media_id: m.media?.id ?? null,
        media_tipo: m.media?.tipo ?? null,
        media_mime: m.media?.mime ?? null,
        media_filename: m.media?.filename ?? null,
      },
      { onConflict: "wa_id", ignoreDuplicates: true },
    );
    if (error) console.error("Supabase insert WA:", error.message);
    return;
  }
  if (mem.some((x) => x.waId === m.waId)) return; // dedup
  mem.push({ ...m, seq: ++memSeq });
  if (mem.length > MAX) mem.splice(0, mem.length - MAX);
}

// Mensaje recibido del cliente.
export async function addInbound(
  m: Omit<WaInbound, "seq" | "direccion">,
): Promise<void> {
  return guardar({ ...m, direccion: "in" });
}

// Mensaje que la empresa envió al cliente (para que persista la conversación).
export async function addOutbound(m: {
  waId: string;
  to: string; // número del cliente (clave de la conversación)
  texto: string;
  ts: string;
  tenant?: string;
}): Promise<void> {
  return guardar({
    waId: m.waId,
    from: m.to,
    texto: m.texto,
    ts: m.ts,
    direccion: "out",
    tenant: m.tenant,
  });
}

// Devuelve los mensajes con cursor (seq/id) mayor al del cliente. Si se pasa
// `tenant`, solo los de ese cliente (así cada dashboard ve lo suyo).
export async function getSince(after: number, tenant?: string): Promise<WaInbound[]> {
  const sb = getSupabase();
  if (sb) {
    let q = sb
      .from("wa_messages")
      .select(
        "id, wa_id, wa_from, nombre, texto, ts, direccion, tenant, media_id, media_tipo, media_mime, media_filename",
      )
      .gt("id", after);
    if (tenant) q = q.eq("tenant", tenant);
    const { data, error } = await q.order("id", { ascending: true }).limit(100);
    if (error) {
      console.error("Supabase select WA:", error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      seq: Number(r.id),
      waId: r.wa_id as string,
      from: r.wa_from as string,
      nombre: (r.nombre as string | null) ?? undefined,
      texto: r.texto as string,
      ts: r.ts as string,
      direccion: ((r.direccion as string | null) ?? "in") as Direccion,
      tenant: (r.tenant as string | null) ?? undefined,
      media: r.media_id
        ? {
            id: r.media_id as string,
            tipo: (r.media_tipo as string | null) ?? "document",
            mime: (r.media_mime as string | null) ?? undefined,
            filename: (r.media_filename as string | null) ?? undefined,
          }
        : undefined,
    }));
  }
  return mem.filter((m) => m.seq > after && (!tenant || m.tenant === tenant));
}

// Borra el historial de conversaciones (para reiniciar el demo). Si se pasa
// `tenant`, solo el de ese cliente.
export async function clearHistory(tenant?: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    for (let i = mem.length - 1; i >= 0; i--) {
      if (!tenant || mem[i].tenant === tenant) mem.splice(i, 1);
    }
    return;
  }
  const base = sb.from("wa_messages").delete();
  const { error } = await (tenant ? base.eq("tenant", tenant) : base.neq("id", 0));
  if (error) console.error("Supabase clear WA:", error.message);
}
