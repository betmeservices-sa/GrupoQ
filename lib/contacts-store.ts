// Ficha del contacto (nombre, correo, notas) y archivos adjuntos. La IA actualiza
// la ficha cuando el cliente da sus datos; los adjuntos los registra el webhook.
import { getSupabase } from "./supabase";

export interface Contacto {
  wa_from: string;
  nombre?: string | null;
  correo?: string | null;
  notas?: string | null;
}

const memContactos = new Map<string, Contacto>();

// Actualiza solo los campos provistos (no borra lo que ya estaba).
export async function upsertContacto(c: {
  from: string;
  nombre?: string;
  correo?: string;
}): Promise<void> {
  const nombre = c.nombre?.trim();
  const correo = c.correo?.trim();
  if (!nombre && !correo) return;

  const sb = getSupabase();
  if (!sb) {
    const prev = memContactos.get(c.from) ?? { wa_from: c.from };
    memContactos.set(c.from, {
      ...prev,
      ...(nombre ? { nombre } : {}),
      ...(correo ? { correo } : {}),
    });
    return;
  }

  const patch: Record<string, unknown> = {
    wa_from: c.from,
    updated_at: new Date().toISOString(),
  };
  if (nombre) patch.nombre = nombre;
  if (correo) patch.correo = correo;

  const { error } = await sb.from("wa_contacts").upsert(patch, { onConflict: "wa_from" });
  if (error) console.error("wa_contacts upsert:", error.message);
}

export async function getContacto(from: string): Promise<Contacto | null> {
  const sb = getSupabase();
  if (!sb) return memContactos.get(from) ?? null;
  const { data, error } = await sb
    .from("wa_contacts")
    .select("wa_from, nombre, correo, notas")
    .eq("wa_from", from)
    .maybeSingle();
  if (error) {
    console.error("wa_contacts select:", error.message);
    return null;
  }
  return (data as Contacto | null) ?? null;
}

// Registra un archivo recibido en la ficha del contacto.
export async function addAdjunto(a: {
  from: string;
  tipo: string;
  mediaId?: string;
  mime?: string;
  filename?: string;
  caption?: string;
  ts: string;
}): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("wa_adjuntos").insert({
    wa_from: a.from,
    tipo: a.tipo,
    media_id: a.mediaId ?? null,
    mime: a.mime ?? null,
    filename: a.filename ?? null,
    caption: a.caption ?? null,
    ts: a.ts,
  });
  if (error) console.error("wa_adjuntos insert:", error.message);
}
