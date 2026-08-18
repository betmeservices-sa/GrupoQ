// A qué sucursal dijo el contacto que le escribe, y cuántas veces se lo hemos
// preguntado. Vive aparte de la ficha del contacto porque es estado del AGENTE
// (la baranda de apertura), no un dato del huésped.
//
// Persiste en Supabase (`wa_sucursal`) para que el webhook lo vea entre
// invocaciones: cada mensaje entrante es una función serverless nueva, así que
// en memoria se perdería y el agente preguntaría la sucursal una y otra vez.

import { getSupabase } from "./supabase";

export interface EstadoSucursal {
  sucursalId: string | null;
  sucursalNombre: string | null;
  /** Veces que ya se preguntó por la sucursal a este número. */
  intentos: number;
}

const VACIO: EstadoSucursal = { sucursalId: null, sucursalNombre: null, intentos: 0 };

const mem = new Map<string, EstadoSucursal>();

export async function getEstadoSucursal(from: string): Promise<EstadoSucursal> {
  const sb = getSupabase();
  if (!sb) return mem.get(from) ?? { ...VACIO };
  const { data, error } = await sb
    .from("wa_sucursal")
    .select("sucursal_id, sucursal_nombre, intentos")
    .eq("wa_from", from)
    .maybeSingle();
  if (error) {
    console.error("wa_sucursal select:", error.message);
    return { ...VACIO };
  }
  if (!data) return { ...VACIO };
  return {
    sucursalId: (data.sucursal_id as string | null) ?? null,
    sucursalNombre: (data.sucursal_nombre as string | null) ?? null,
    intentos: Number(data.intentos ?? 0),
  };
}

/** Suma uno al contador de veces que se preguntó por la sucursal. */
export async function marcarPreguntaSucursal(
  from: string,
  tenant: string,
  intentosPrevios: number,
): Promise<void> {
  const intentos = intentosPrevios + 1;
  const sb = getSupabase();
  if (!sb) {
    const prev = mem.get(from) ?? { ...VACIO };
    mem.set(from, { ...prev, intentos });
    return;
  }
  const { error } = await sb.from("wa_sucursal").upsert(
    { wa_from: from, tenant, intentos, updated_at: new Date().toISOString() },
    { onConflict: "wa_from" },
  );
  if (error) console.error("wa_sucursal upsert (pregunta):", error.message);
}

/** Guarda la sucursal que el contacto confirmó. No se vuelve a preguntar. */
export async function guardarSucursal(
  from: string,
  tenant: string,
  sucursalId: string,
  sucursalNombre: string,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const prev = mem.get(from) ?? { ...VACIO };
    mem.set(from, { ...prev, sucursalId, sucursalNombre });
    return;
  }
  const { error } = await sb.from("wa_sucursal").upsert(
    {
      wa_from: from,
      tenant,
      sucursal_id: sucursalId,
      sucursal_nombre: sucursalNombre,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wa_from" },
  );
  if (error) console.error("wa_sucursal upsert (elección):", error.message);
}

/** Reinicia el estado de un número (lo usa el borrado de conversación). */
export async function borrarEstadoSucursal(from: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    mem.delete(from);
    return;
  }
  const { error } = await sb.from("wa_sucursal").delete().eq("wa_from", from);
  if (error) console.error("wa_sucursal delete:", error.message);
}
