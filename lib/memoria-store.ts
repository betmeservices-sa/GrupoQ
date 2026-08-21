// Persistencia de la memoria del agente de voz. Tabla `memoria_llamadas` en
// Supabase cuando hay env y la tabla existe; si no, memoria del proceso.
//
// OJO: acá el modo memoria sirve de MUY poco. El webhook que guarda y el que
// consulta son invocaciones serverless distintas, así que sin la tabla lo que
// se guarda al colgar probablemente no lo vea la llamada siguiente. Para esta
// función en particular, correr la migración no es opcional.

import { getSupabase } from "./supabase";
import { columnaFaltante, latchDeTabla, tablaFaltante } from "./tabla-faltante";
import type { MemoriaLlamada } from "./memoria-llamadas";
import { normalizarTelefono } from "./memoria-llamadas";

const COLS = "tenant, telefono, nombre, modelos, uso, pago, agendo, resumen, llamadas, ultima, ultimo_call_id";

const mem = new Map<string, MemoriaLlamada>();
const faltaTabla = latchDeTabla();

const llave = (tenant: string, telefono: string) => `${tenant}:${normalizarTelefono(telefono)}`;

export function memoriaEnMemoria(): boolean {
  return getSupabase() === null || faltaTabla.activo();
}

function aFila(m: MemoriaLlamada) {
  return {
    tenant: m.tenant,
    telefono: m.telefono,
    nombre: m.nombre ?? null,
    modelos: m.modelos,
    uso: m.uso ?? null,
    pago: m.pago ?? null,
    agendo: m.agendo,
    resumen: m.resumen,
    llamadas: m.llamadas,
    ultima: m.ultima,
    ultimo_call_id: m.ultimoCallId ?? null,
  };
}

function deFila(f: Record<string, unknown>): MemoriaLlamada {
  return {
    tenant: String(f.tenant),
    telefono: String(f.telefono),
    nombre: (f.nombre as string) ?? undefined,
    modelos: Array.isArray(f.modelos) ? (f.modelos as string[]) : [],
    uso: (f.uso as string) ?? undefined,
    pago: (f.pago as string) ?? undefined,
    agendo: Boolean(f.agendo),
    resumen: String(f.resumen ?? ""),
    llamadas: Number(f.llamadas ?? 0),
    ultima: String(f.ultima),
    ultimoCallId: (f.ultimo_call_id as string) ?? undefined,
  };
}

export async function leerMemoria(tenant: string, telefono: string): Promise<MemoriaLlamada | null> {
  const tel = normalizarTelefono(telefono);
  if (!tel) return null;

  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) return mem.get(llave(tenant, tel)) ?? null;

  const { data, error } = await sb
    .from("memoria_llamadas")
    .select(COLS)
    .eq("tenant", tenant)
    .eq("telefono", tel)
    .maybeSingle();
  if (error) {
    if (tablaFaltante(error) || columnaFaltante(error)) {
      faltaTabla.marcar();
      return mem.get(llave(tenant, tel)) ?? null;
    }
    // Un error de lectura no puede tumbar la llamada: sin memoria el agente
    // atiende igual, solo que sin acordarse. Se avisa y se sigue.
    console.error("[memoria] no se pudo leer:", error.message);
    return null;
  }
  return data ? deFila(data as Record<string, unknown>) : null;
}

export async function guardarMemoria(m: MemoriaLlamada): Promise<void> {
  const registro: MemoriaLlamada = { ...m, telefono: normalizarTelefono(m.telefono) };
  if (!registro.telefono) return;

  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) {
    mem.set(llave(registro.tenant, registro.telefono), registro);
    return;
  }
  const { error } = await sb
    .from("memoria_llamadas")
    .upsert(aFila(registro), { onConflict: "tenant,telefono" });
  if (error) {
    if (tablaFaltante(error) || columnaFaltante(error)) {
      faltaTabla.marcar();
      mem.set(llave(registro.tenant, registro.telefono), registro);
      return;
    }
    console.error("[memoria] no se pudo guardar:", error.message);
  }
}

/** Solo para las pruebas. */
export function _resetMemoriaMem() {
  mem.clear();
}
