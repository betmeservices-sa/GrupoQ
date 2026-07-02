// Persistencia de mensajes de WhatsApp (recibidos y enviados).
// Si hay Supabase configurado, guarda/lee de la tabla `wa_messages` (persiste,
// sobrevive reinicios, sirve desplegado). Si no, cae a un store EN MEMORIA.
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
}): Promise<void> {
  return guardar({
    waId: m.waId,
    from: m.to,
    texto: m.texto,
    ts: m.ts,
    direccion: "out",
  });
}

// Devuelve los mensajes con cursor (seq/id) mayor al del cliente.
export async function getSince(after: number): Promise<WaInbound[]> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb
      .from("wa_messages")
      .select(
        "id, wa_id, wa_from, nombre, texto, ts, direccion, media_id, media_tipo, media_mime, media_filename",
      )
      .gt("id", after)
      .order("id", { ascending: true })
      .limit(100);
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
  return mem.filter((m) => m.seq > after);
}
