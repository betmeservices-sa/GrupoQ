// Clics en los links rastreables de las bios, con sus UTMs.
//
// Esto es lo que un `wa.me` pelado no puede dar: cuánta gente TOCÓ el link de
// cada perfil, con qué campaña, y cuántos de esos terminaron escribiendo. El
// clic se registra en nuestro dominio, antes de mandarlos a WhatsApp.
//
// Persistencia igual que el resto: tabla en Supabase si hay env y existe, y si
// no, memoria del proceso.

import { getSupabase } from "./supabase";
import { latchDeTabla, tablaFaltante } from "./tabla-faltante";

export interface ClicBio {
  tenant: string;
  codigo: string; // el link que se tocó
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  referer?: string | null;
  ts: string; // ISO 8601
}

export interface ResumenClics {
  codigo: string;
  clics: number;
  ultimo: string | null;
  // Campañas distintas que trajeron esos clics, para no perder el detalle de
  // UTM cuando el mismo link se usa en varias piezas.
  campanas: string[];
}

const COLS = "tenant, codigo, utm_source, utm_medium, utm_campaign, referer, ts";
const mem: ClicBio[] = [];
// Se apaga sola a los minutos (ver latchDeTabla): correr la migración alcanza.
const faltaTabla = latchDeTabla();

const MAX_MEM = 500;

export function clicsEnMemoria(): boolean {
  return getSupabase() === null || faltaTabla.activo();
}

export async function registrarClic(c: ClicBio): Promise<void> {
  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) {
    mem.unshift(c);
    if (mem.length > MAX_MEM) mem.length = MAX_MEM;
    return;
  }
  const { error } = await sb.from("clics_bio").insert(c);
  if (error) {
    if (tablaFaltante(error)) {
      faltaTabla.marcar();
      mem.unshift(c);
      return;
    }
    // Un clic perdido NO puede costarle la visita al hotel: se registra el
    // error y el redirect sigue igual.
    console.error("clics_bio insert:", error.message);
  }
}

function resumir(clics: ClicBio[]): ResumenClics[] {
  const porCodigo = new Map<string, ClicBio[]>();
  for (const c of clics) {
    const lista = porCodigo.get(c.codigo);
    if (lista) lista.push(c);
    else porCodigo.set(c.codigo, [c]);
  }
  return [...porCodigo.entries()].map(([codigo, lista]) => ({
    codigo,
    clics: lista.length,
    ultimo: lista.map((c) => c.ts).sort().at(-1) ?? null,
    campanas: [...new Set(lista.map((c) => c.utm_campaign).filter(Boolean) as string[])],
  }));
}

/** Clics por link, desde una fecha (ISO). */
export async function resumenClics(tenant: string, desde: string): Promise<ResumenClics[]> {
  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) {
    return resumir(mem.filter((c) => c.tenant === tenant && c.ts >= desde));
  }
  const { data, error } = await sb
    .from("clics_bio")
    .select(COLS)
    .eq("tenant", tenant)
    .gte("ts", desde)
    .limit(5000);
  if (error) {
    if (tablaFaltante(error)) {
      faltaTabla.marcar();
      return resumir(mem.filter((c) => c.tenant === tenant && c.ts >= desde));
    }
    throw new Error(error.message);
  }
  return resumir((data ?? []) as ClicBio[]);
}
