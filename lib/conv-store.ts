// Estado de conversaciones de WhatsApp (asignacion, estado, departamento).
// Respaldado en Supabase; cae a memoria si no hay env configurado.
import { getSupabase } from "./supabase";

export interface Conversacion {
  wa_from: string;
  asignado_a: string | null;
  estado: string | null;
  departamento: string | null;
}

// Fallback en memoria.
const memConvs = new Map<string, Conversacion>();

export async function getConversaciones(): Promise<Conversacion[]> {
  const sb = getSupabase();
  if (!sb) {
    return Array.from(memConvs.values());
  }
  const { data, error } = await sb
    .from("wa_conversaciones")
    .select("wa_from, asignado_a, estado, departamento");
  if (error) {
    console.error("wa_conversaciones select:", error.message);
    return [];
  }
  return (data ?? []) as Conversacion[];
}

export async function upsertConversacion(c: {
  wa_from: string;
  asignado_a?: string | null;
  estado?: string;
  departamento?: string;
}): Promise<void> {
  const sb = getSupabase();

  if (!sb) {
    const prev = memConvs.get(c.wa_from) ?? {
      wa_from: c.wa_from,
      asignado_a: null,
      estado: null,
      departamento: null,
    };
    // null explicito desasigna; undefined no toca el campo.
    memConvs.set(c.wa_from, {
      wa_from: c.wa_from,
      asignado_a: "asignado_a" in c ? (c.asignado_a ?? null) : prev.asignado_a,
      estado: c.estado !== undefined ? c.estado : (prev.estado ?? null),
      departamento:
        c.departamento !== undefined ? c.departamento : (prev.departamento ?? null),
    });
    return;
  }

  // Solo incluye los campos presentes en el objeto (upsert parcial).
  const patch: Record<string, unknown> = {
    wa_from: c.wa_from,
    updated_at: new Date().toISOString(),
  };
  // "asignado_a" in c distingue null explicito de undefined (campo ausente).
  if ("asignado_a" in c) patch.asignado_a = c.asignado_a ?? null;
  if (c.estado !== undefined) patch.estado = c.estado;
  if (c.departamento !== undefined) patch.departamento = c.departamento;

  const { error } = await sb
    .from("wa_conversaciones")
    .upsert(patch, { onConflict: "wa_from" });
  if (error) console.error("wa_conversaciones upsert:", error.message);
}
