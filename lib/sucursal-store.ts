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
  /**
   * Código del link que trajo al contacto (ver lib/enlaces.ts), o null si llegó
   * por su cuenta. Es lo que permite unir la conversación con el clic y su UTM.
   */
  origen: string | null;
}

const VACIO: EstadoSucursal = { sucursalId: null, sucursalNombre: null, intentos: 0, origen: null };

const mem = new Map<string, EstadoSucursal>();

export async function getEstadoSucursal(from: string): Promise<EstadoSucursal> {
  const sb = getSupabase();
  if (!sb) return mem.get(from) ?? { ...VACIO };
  const { data, error } = await sb
    .from("wa_sucursal")
    .select("sucursal_id, sucursal_nombre, intentos, origen")
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
    origen: (data.origen as string | null) ?? null,
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
  /** Link que lo trajo, si vino por uno (lib/enlaces.ts). */
  origen?: string | null,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) {
    const prev = mem.get(from) ?? { ...VACIO };
    mem.set(from, { ...prev, sucursalId, sucursalNombre, origen: origen ?? prev.origen });
    return;
  }
  const { error } = await sb.from("wa_sucursal").upsert(
    {
      wa_from: from,
      tenant,
      sucursal_id: sucursalId,
      sucursal_nombre: sucursalNombre,
      // Solo se escribe si vino: no se pisa un origen ya guardado con null.
      ...(origen ? { origen } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "wa_from" },
  );
  if (error) console.error("wa_sucursal upsert (elección):", error.message);
}

/**
 * Cuántos contactos entraron por cada link rastreable. Es la otra mitad de la
 * medición: los clics dicen cuánta gente tocó el link, esto dice cuánta terminó
 * escribiendo.
 */
export async function conversacionesPorOrigen(tenant: string): Promise<Record<string, number>> {
  const sb = getSupabase();
  const cuenta: Record<string, number> = {};
  if (!sb) {
    for (const e of mem.values()) {
      if (e.origen) cuenta[e.origen] = (cuenta[e.origen] ?? 0) + 1;
    }
    return cuenta;
  }
  const { data, error } = await sb
    .from("wa_sucursal")
    .select("origen")
    .eq("tenant", tenant)
    .not("origen", "is", null)
    .limit(5000);
  if (error) {
    console.error("wa_sucursal por origen:", error.message);
    return cuenta;
  }
  for (const fila of (data ?? []) as { origen?: string | null }[]) {
    if (fila.origen) cuenta[fila.origen] = (cuenta[fila.origen] ?? 0) + 1;
  }
  return cuenta;
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
