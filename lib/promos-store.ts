// Persistencia de las promociones. Tabla `promos` en Supabase cuando hay env y
// la tabla existe; si no, memoria del proceso (igual que el resto de stores del
// demo).
//
// OJO con el modo memoria en producción: el panel y el webhook de WhatsApp son
// funciones serverless distintas, cada una con su memoria. Sin la tabla, una
// promo encendida desde el panel puede no verla el agente. Por eso la migración
// va incluida (supabase/migrations/20260819000000_promos_y_perfil.sql) y el
// panel avisa mientras se esté guardando en memoria.

import { getSupabase } from "./supabase";
import { latchDeTabla, tablaFaltante } from "./tabla-faltante";
import type { Promocion, PromocionNueva } from "./promos";

const COLS =
  "id, tenant, nombre, descripcion, precio, restricciones, desde, hasta, activa, actualizada";

const mem = new Map<string, Promocion>();
// Se enciende cuando Supabase responde "esa tabla no existe", y se apaga sola
// a los minutos: así, correr la migración alcanza para que se enganche, sin
// tener que redesplegar.
const faltaTabla = latchDeTabla();

/** true si estamos guardando solo en memoria (lo pinta el panel como aviso). */
export function promosEnMemoria(): boolean {
  return getSupabase() === null || faltaTabla.activo();
}

/** true si hay base pero le falta la migración (el aviso es distinto). */
export function promosSinTabla(): boolean {
  return getSupabase() !== null && faltaTabla.activo();
}

function nuevoId(): string {
  return `promo-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizar(p: PromocionNueva): PromocionNueva {
  return {
    nombre: p.nombre.trim(),
    descripcion: p.descripcion.trim(),
    precio: p.precio.trim(),
    restricciones: p.restricciones.trim(),
    desde: p.desde?.trim() || undefined,
    hasta: p.hasta?.trim() || undefined,
    activa: p.activa !== false,
  };
}

function deMemoria(tenant: string): Promocion[] {
  return [...mem.values()]
    .filter((p) => p.tenant === tenant)
    .sort((a, b) => (a.actualizada < b.actualizada ? 1 : -1));
}

export async function listarPromos(tenant: string): Promise<Promocion[]> {
  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) return deMemoria(tenant);

  const { data, error } = await sb
    .from("promos")
    .select(COLS)
    .eq("tenant", tenant)
    .order("actualizada", { ascending: false });
  if (error) {
    if (tablaFaltante(error)) {
      faltaTabla.marcar();
      return deMemoria(tenant);
    }
    // Un error de lectura NO se convierte en "no hay promociones": eso haría
    // que el agente dijera que no hay ofertas cuando sí las hay. Se propaga.
    throw new Error(error.message);
  }
  return (data ?? []) as Promocion[];
}

export async function crearPromo(tenant: string, entrada: PromocionNueva): Promise<Promocion> {
  const base = normalizar(entrada);
  const promo: Promocion = {
    ...base,
    id: nuevoId(),
    tenant,
    activa: base.activa,
    actualizada: new Date().toISOString(),
  };
  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) {
    mem.set(promo.id, promo);
    return promo;
  }
  const { data, error } = await sb.from("promos").insert(promo).select(COLS).single();
  if (error) {
    if (tablaFaltante(error)) {
      faltaTabla.marcar();
      mem.set(promo.id, promo);
      return promo;
    }
    throw new Error(error.message);
  }
  return data as Promocion;
}

export async function actualizarPromo(
  tenant: string,
  id: string,
  cambios: Partial<PromocionNueva>,
): Promise<Promocion | null> {
  const parche: Record<string, unknown> = { actualizada: new Date().toISOString() };
  for (const k of ["nombre", "descripcion", "precio", "restricciones"] as const) {
    if (cambios[k] !== undefined) parche[k] = String(cambios[k]).trim();
  }
  for (const k of ["desde", "hasta"] as const) {
    if (cambios[k] !== undefined) parche[k] = String(cambios[k]).trim() || null;
  }
  if (cambios.activa !== undefined) parche.activa = cambios.activa;

  const enMemoria = (): Promocion | null => {
    const actual = mem.get(id);
    if (!actual || actual.tenant !== tenant) return null;
    const next = { ...actual, ...parche } as Promocion;
    mem.set(id, next);
    return next;
  };

  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) return enMemoria();

  const { data, error } = await sb
    .from("promos")
    .update(parche)
    .eq("id", id)
    .eq("tenant", tenant)
    .select(COLS)
    .maybeSingle();
  if (error) {
    if (tablaFaltante(error)) {
      faltaTabla.marcar();
      return enMemoria();
    }
    throw new Error(error.message);
  }
  return (data as Promocion) ?? null;
}

export async function borrarPromo(tenant: string, id: string): Promise<void> {
  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) {
    const actual = mem.get(id);
    if (actual?.tenant === tenant) mem.delete(id);
    return;
  }
  const { error } = await sb.from("promos").delete().eq("id", id).eq("tenant", tenant);
  if (error) {
    if (tablaFaltante(error)) {
      faltaTabla.marcar();
      mem.delete(id);
      return;
    }
    throw new Error(error.message);
  }
}
