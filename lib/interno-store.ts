// El chat interno del equipo, guardado de verdad.
//
// Antes esto vivía en la memoria del navegador: se veía como un chat, pero un
// mensaje nunca llegaba al otro lado porque cada quien tenía su propia copia.
//
// Igual que el resto de stores, si no hay Supabase cae a memoria. Acá esa caída
// duele más que en otros lados (un chat que no entrega no es un chat), así que
// se avisa con `internoEnMemoria()` en vez de fallar callado.

import { getSupabase } from "./supabase";
import { latchDeTabla } from "./tabla-faltante";

export interface CanalInterno {
  id: string;
  nombre: string;
  tipo: "canal" | "dm";
  miembros: string[];
}

export interface MensajeInterno {
  id: number;
  canalId: string;
  autor: string;
  texto: string;
  ts: string;
}

const faltaTabla = latchDeTabla();

interface Memoria {
  canales: Map<string, CanalInterno[]>;
  mensajes: MensajeInterno[];
  seq: number;
}
const g = globalThis as unknown as { __interno?: Memoria };
const mem: Memoria = (g.__interno ??= {
  canales: new Map<string, CanalInterno[]>(),
  mensajes: [] as MensajeInterno[],
  seq: 0,
});

/** ¿Se está guardando solo en memoria? Un chat así no entrega nada. */
export function internoEnMemoria(): boolean {
  return getSupabase() === null || faltaTabla.activo();
}

// ── Canales ──────────────────────────────────────────────────────────────────

export async function listarCanales(tenant: string): Promise<CanalInterno[]> {
  const sb = getSupabase(tenant);
  if (!sb || faltaTabla.activo()) return mem.canales.get(tenant) ?? [];

  const { data, error } = await sb
    .from("interno_canales")
    .select("id,nombre,tipo,miembros")
    .eq("tenant", tenant)
    .order("creado", { ascending: true });

  if (error) {
    faltaTabla.marcar();
    return mem.canales.get(tenant) ?? [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    nombre: r.nombre as string,
    tipo: (r.tipo as "canal" | "dm") ?? "canal",
    miembros: (r.miembros as string[]) ?? [],
  }));
}

export async function guardarCanal(tenant: string, c: CanalInterno): Promise<CanalInterno> {
  const sb = getSupabase(tenant);
  if (!sb || faltaTabla.activo()) {
    const lista = mem.canales.get(tenant) ?? [];
    mem.canales.set(tenant, [...lista.filter((x: CanalInterno) => x.id !== c.id), c]);
    return c;
  }
  const { error } = await sb
    .from("interno_canales")
    .upsert({ id: c.id, tenant, nombre: c.nombre, tipo: c.tipo, miembros: c.miembros }, { onConflict: "id" });
  if (error) faltaTabla.marcar();
  return c;
}

export async function borrarCanal(tenant: string, id: string): Promise<void> {
  const sb = getSupabase(tenant);
  if (!sb || faltaTabla.activo()) {
    mem.canales.set(tenant, (mem.canales.get(tenant) ?? []).filter((c: CanalInterno) => c.id !== id));
    return;
  }
  await sb.from("interno_canales").delete().eq("tenant", tenant).eq("id", id);
}

// ── Mensajes ─────────────────────────────────────────────────────────────────

export async function mensajesDesde(
  tenant: string,
  after: number,
): Promise<MensajeInterno[]> {
  const sb = getSupabase(tenant);
  if (!sb || faltaTabla.activo()) {
    return mem.mensajes.filter((m) => m.id > after);
  }
  const { data, error } = await sb
    .from("interno_mensajes")
    .select("id,canal_id,autor,texto,ts")
    .eq("tenant", tenant)
    .gt("id", after)
    .order("id", { ascending: true })
    .limit(200);
  if (error) {
    faltaTabla.marcar();
    return mem.mensajes.filter((m) => m.id > after);
  }
  return (data ?? []).map((r) => ({
    id: Number(r.id),
    canalId: r.canal_id as string,
    autor: r.autor as string,
    texto: r.texto as string,
    ts: r.ts as string,
  }));
}

export async function enviarMensaje(
  tenant: string,
  canalId: string,
  autor: string,
  texto: string,
): Promise<MensajeInterno | null> {
  const sb = getSupabase(tenant);
  if (!sb || faltaTabla.activo()) {
    const m: MensajeInterno = {
      id: ++mem.seq,
      canalId,
      autor,
      texto,
      ts: new Date().toISOString(),
    };
    mem.mensajes.push(m);
    if (mem.mensajes.length > 500) mem.mensajes.shift();
    return m;
  }
  const { data, error } = await sb
    .from("interno_mensajes")
    .insert({ tenant, canal_id: canalId, autor, texto })
    .select("id,canal_id,autor,texto,ts")
    .single();
  if (error || !data) {
    faltaTabla.marcar();
    return null;
  }
  return {
    id: Number(data.id),
    canalId: data.canal_id as string,
    autor: data.autor as string,
    texto: data.texto as string,
    ts: data.ts as string,
  };
}

// ── Lo leído ─────────────────────────────────────────────────────────────────

/** Hasta qué mensaje llegó cada persona, por canal. De acá sale el punto rojo. */
export async function leidoDe(tenant: string, usuario: string): Promise<Record<string, number>> {
  const sb = getSupabase(tenant);
  if (!sb || faltaTabla.activo()) return {};
  const { data, error } = await sb
    .from("interno_leido")
    .select("canal_id,ultimo_id")
    .eq("tenant", tenant)
    .eq("usuario", usuario);
  if (error) {
    faltaTabla.marcar();
    return {};
  }
  const out: Record<string, number> = {};
  for (const r of data ?? []) out[r.canal_id as string] = Number(r.ultimo_id);
  return out;
}

export async function marcarLeido(
  tenant: string,
  usuario: string,
  canalId: string,
  ultimoId: number,
): Promise<void> {
  const sb = getSupabase(tenant);
  if (!sb || faltaTabla.activo()) return;
  const { error } = await sb
    .from("interno_leido")
    .upsert(
      { tenant, usuario, canal_id: canalId, ultimo_id: ultimoId },
      { onConflict: "tenant,canal_id,usuario" },
    );
  if (error) faltaTabla.marcar();
}
