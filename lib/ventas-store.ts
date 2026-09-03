// Persistencia del embudo de ventas: solicitudes, expediente y bitácora.
//
// Una fila por prospecto en `ventas_solicitudes`, con la MISMA llave que la
// ficha del contacto (wa_from), para que el tablero, la conversación y los
// adjuntos hablen de la misma persona. Cada movimiento deja un renglón en
// `ventas_eventos`: de ahí salen los tiempos que mira el gerente.
//
// Sin Supabase cae a memoria, igual que el resto de los stores, para poder
// trabajar en local sin base.

import { getSupabase } from "./supabase";
import {
  detalleDocumentacion,
  etapaDe,
  expedienteCompleto,
  siguienteVendedor,
  type EstadoDoc,
  type Expediente,
  type MotivoRechazo,
  type Resultado,
  type Solicitud,
  type Vendedor,
} from "./ventas-pipeline";

const TABLA = "ventas_solicitudes";
const TABLA_EVENTOS = "ventas_eventos";
const COLS =
  "tenant, wa_from, nombre, vehiculo, expediente, vendedor, creado, contactado, pedidos, completado, asignado, tomado, cerrado, resultado, motivo_cierre, avisado, escalado, actualizado";

export type TipoEvento =
  | "creado"
  | "contactado"
  | "documentos_pedidos"
  | "doc_recibido"
  | "doc_aprobado"
  | "doc_rechazado"
  | "completado"
  | "asignado"
  | "reasignado"
  | "tomado"
  | "cerrado"
  | "aviso_gerente"
  | "vencido";

export interface Evento {
  ts: string;
  tipo: TipoEvento;
  actor: string | null;
  detalle: string | null;
}

// Memoria: solo para desarrollo sin Supabase.
const mem = new Map<string, Solicitud>();
const memEventos: (Evento & { tenant: string; telefono: string })[] = [];
const llave = (tenant: string, telefono: string) => `${tenant}|${telefono}`;

type Fila = Record<string, unknown>;

function aSolicitud(f: Fila): Solicitud {
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    tenant: (f.tenant as string) ?? "",
    telefono: (f.wa_from as string) ?? "",
    nombre: (f.nombre as string) ?? "",
    vehiculo: (f.vehiculo as string | null) ?? null,
    expediente: ((f.expediente as Expediente | null) ?? {}) as Expediente,
    vendedor: (f.vendedor as string | null) ?? null,
    creado: iso(f.creado) ?? new Date().toISOString(),
    contactado: iso(f.contactado),
    pedidos: iso(f.pedidos),
    completado: iso(f.completado),
    asignado: iso(f.asignado),
    tomado: iso(f.tomado),
    cerrado: iso(f.cerrado),
    resultado: (f.resultado as Resultado | null) ?? null,
    motivoCierre: (f.motivo_cierre as string | null) ?? null,
    avisado: iso(f.avisado),
    escalado: iso(f.escalado),
    actualizado: iso(f.actualizado) ?? new Date().toISOString(),
  };
}

function aFila(s: Solicitud): Fila {
  return {
    tenant: s.tenant,
    wa_from: s.telefono,
    nombre: s.nombre,
    vehiculo: s.vehiculo ?? null,
    expediente: s.expediente,
    vendedor: s.vendedor,
    creado: s.creado,
    contactado: s.contactado,
    pedidos: s.pedidos,
    completado: s.completado,
    asignado: s.asignado,
    tomado: s.tomado,
    cerrado: s.cerrado,
    resultado: s.resultado,
    motivo_cierre: s.motivoCierre,
    avisado: s.avisado,
    escalado: s.escalado,
    actualizado: s.actualizado,
  };
}

export async function listarSolicitudes(tenant: string): Promise<Solicitud[]> {
  const sb = getSupabase(tenant);
  if (!sb) {
    return [...mem.values()].filter((s) => s.tenant === tenant).sort((a, b) => b.actualizado.localeCompare(a.actualizado));
  }
  const { data, error } = await sb.from(TABLA).select(COLS).eq("tenant", tenant).order("actualizado", { ascending: false });
  if (error) {
    console.error("ventas_solicitudes list:", error.message);
    return [];
  }
  return ((data as Fila[]) ?? []).map(aSolicitud);
}

export async function leerSolicitud(tenant: string, telefono: string): Promise<Solicitud | null> {
  const sb = getSupabase(tenant);
  if (!sb) return mem.get(llave(tenant, telefono)) ?? null;
  const { data, error } = await sb.from(TABLA).select(COLS).eq("tenant", tenant).eq("wa_from", telefono).maybeSingle();
  if (error || !data) return null;
  return aSolicitud(data as Fila);
}

/**
 * Escribe la solicitud tal cual, RESPETANDO su fecha de último movimiento. Lo
 * usa el sembrado del demo: si se le pusiera la hora de ahora, los 23 casos
 * quedarían "hace 2 minutos" y el tablero se vería recién nacido.
 */
export async function guardarSolicitud(s: Solicitud): Promise<Solicitud> {
  return guardar(s, true);
}

async function guardar(s: Solicitud, conservarFecha = false): Promise<Solicitud> {
  const fila = conservarFecha ? s : { ...s, actualizado: new Date().toISOString() };
  const sb = getSupabase(s.tenant);
  if (!sb) {
    mem.set(llave(s.tenant, s.telefono), fila);
    return fila;
  }
  const { error } = await sb.from(TABLA).upsert(aFila(fila), { onConflict: "tenant,wa_from" });
  if (error) console.error("ventas_solicitudes upsert:", error.message);
  return fila;
}

export async function registrarEvento(
  tenant: string,
  telefono: string,
  tipo: TipoEvento,
  actor: string | null,
  detalle?: string | null,
): Promise<void> {
  const ts = new Date().toISOString();
  const sb = getSupabase(tenant);
  if (!sb) {
    memEventos.push({ tenant, telefono, ts, tipo, actor, detalle: detalle ?? null });
    return;
  }
  const { error } = await sb.from(TABLA_EVENTOS).insert({ tenant, wa_from: telefono, tipo, actor, detalle: detalle ?? null });
  if (error) console.error("ventas_eventos insert:", error.message);
}

export async function eventosDe(tenant: string, telefono: string, tope = 50): Promise<Evento[]> {
  const sb = getSupabase(tenant);
  if (!sb) {
    return memEventos
      .filter((e) => e.tenant === tenant && e.telefono === telefono)
      .sort((a, b) => b.ts.localeCompare(a.ts))
      .slice(0, tope)
      .map(({ ts, tipo, actor, detalle }) => ({ ts, tipo, actor, detalle }));
  }
  const { data, error } = await sb
    .from(TABLA_EVENTOS)
    .select("ts, tipo, actor, detalle")
    .eq("tenant", tenant)
    .eq("wa_from", telefono)
    .order("ts", { ascending: false })
    .limit(tope);
  if (error) {
    console.error("ventas_eventos select:", error.message);
    return [];
  }
  return (data as Evento[]) ?? [];
}

/** Crea la solicitud si el prospecto todavía no tiene una. */
export async function asegurarSolicitud(
  tenant: string,
  telefono: string,
  datos?: { nombre?: string; vehiculo?: string | null },
): Promise<Solicitud> {
  const previa = await leerSolicitud(tenant, telefono);
  if (previa) {
    // El nombre puede llegar después (la persona lo dice a mitad del chat).
    if (datos?.nombre && !previa.nombre) return guardar({ ...previa, nombre: datos.nombre });
    return previa;
  }
  const ahora = new Date().toISOString();
  const nueva: Solicitud = {
    tenant,
    telefono,
    nombre: datos?.nombre ?? "",
    vehiculo: datos?.vehiculo ?? null,
    expediente: {},
    vendedor: null,
    creado: ahora,
    contactado: null,
    pedidos: null,
    completado: null,
    asignado: null,
    tomado: null,
    cerrado: null,
    resultado: null,
    motivoCierre: null,
    avisado: null,
    escalado: null,
    actualizado: ahora,
  };
  await registrarEvento(tenant, telefono, "creado", "sistema", null);
  return guardar(nueva);
}

// ---- Movimientos ------------------------------------------------------------

export async function marcarContactado(tenant: string, telefono: string, actor: string): Promise<Solicitud | null> {
  const s = await leerSolicitud(tenant, telefono);
  if (!s || s.contactado) return s;
  await registrarEvento(tenant, telefono, "contactado", actor);
  return guardar({ ...s, contactado: new Date().toISOString() });
}

export async function marcarDocumentosPedidos(tenant: string, telefono: string, actor: string): Promise<Solicitud | null> {
  const s = await leerSolicitud(tenant, telefono);
  if (!s) return null;
  const ahora = new Date().toISOString();
  if (s.pedidos) return s;
  await registrarEvento(tenant, telefono, "documentos_pedidos", actor);
  return guardar({ ...s, contactado: s.contactado ?? ahora, pedidos: ahora });
}

/**
 * Mueve un documento del expediente. Si con esto quedan los cuatro aprobados,
 * el expediente se marca completo y se reparte a un vendedor en el mismo golpe:
 * es exactamente el momento en que el caso deja de ser papeleo y pasa a venta.
 */
export async function moverDocumento(opciones: {
  tenant: string;
  telefono: string;
  documento: string;
  estado: EstadoDoc;
  motivo?: MotivoRechazo | null;
  nota?: string | null;
  actor: string;
  vendedores?: Vendedor[];
}): Promise<Solicitud | null> {
  const { tenant, telefono, documento, estado, actor } = opciones;
  const s = await leerSolicitud(tenant, telefono);
  if (!s) return null;
  const ahora = new Date().toISOString();

  const expediente: Expediente = {
    ...s.expediente,
    [documento]: {
      estado,
      motivo: estado === "rechazado" ? (opciones.motivo ?? "otro") : null,
      nota: opciones.nota ?? null,
      ts: ahora,
      por: actor,
    },
  };
  if (estado === "falta") delete expediente[documento];

  const tipo: TipoEvento =
    estado === "aprobado" ? "doc_aprobado" : estado === "rechazado" ? "doc_rechazado" : "doc_recibido";
  await registrarEvento(tenant, telefono, tipo, actor, documento);

  let siguiente: Solicitud = {
    ...s,
    expediente,
    contactado: s.contactado ?? ahora,
    pedidos: s.pedidos ?? ahora,
  };

  const completoAhora = expedienteCompleto(expediente);
  if (completoAhora && !s.completado) {
    siguiente = { ...siguiente, completado: ahora };
    await registrarEvento(tenant, telefono, "completado", actor);
    const vendedor = siguienteVendedor(opciones.vendedores ?? [], await listarSolicitudes(tenant));
    if (vendedor && !siguiente.vendedor) {
      siguiente = { ...siguiente, vendedor: vendedor.id, asignado: ahora };
      await registrarEvento(tenant, telefono, "asignado", "sistema", vendedor.nombre);
    }
  }
  // Si un documento se cae después de estar completo, el caso vuelve al
  // expediente: no se queda "completo" con un papel rechazado adentro.
  if (!completoAhora && s.completado) {
    siguiente = { ...siguiente, completado: null };
  }
  return guardar(siguiente);
}

export async function asignarVendedor(
  tenant: string,
  telefono: string,
  vendedorId: string,
  actor: string,
  nombreVendedor?: string,
): Promise<Solicitud | null> {
  const s = await leerSolicitud(tenant, telefono);
  if (!s) return null;
  const ahora = new Date().toISOString();
  await registrarEvento(tenant, telefono, s.vendedor ? "reasignado" : "asignado", actor, nombreVendedor ?? vendedorId);
  return guardar({
    ...s,
    vendedor: vendedorId,
    asignado: ahora,
    // Reasignar reinicia el reloj y las alertas: el plazo es del vendedor nuevo.
    tomado: null,
    avisado: null,
    escalado: null,
  });
}

export async function marcarTomado(tenant: string, telefono: string, actor: string): Promise<Solicitud | null> {
  const s = await leerSolicitud(tenant, telefono);
  if (!s || s.tomado) return s;
  await registrarEvento(tenant, telefono, "tomado", actor);
  return guardar({ ...s, tomado: new Date().toISOString() });
}

export async function cerrarSolicitud(
  tenant: string,
  telefono: string,
  resultado: Resultado,
  motivo: string | null,
  actor: string,
): Promise<Solicitud | null> {
  const s = await leerSolicitud(tenant, telefono);
  if (!s) return null;
  const ahora = new Date().toISOString();
  await registrarEvento(tenant, telefono, "cerrado", actor, resultado === "venta" ? "Venta" : motivo ?? "Perdido");
  return guardar({
    ...s,
    cerrado: ahora,
    resultado,
    motivoCierre: motivo,
    // Cerrar sin haberlo tomado igual cuenta como tomado: alguien lo trabajó.
    tomado: s.tomado ?? ahora,
  });
}

/** Vuelve a abrir un caso cerrado por error. */
export async function reabrirSolicitud(tenant: string, telefono: string, actor: string): Promise<Solicitud | null> {
  const s = await leerSolicitud(tenant, telefono);
  if (!s) return null;
  await registrarEvento(tenant, telefono, "asignado", actor, "reabierto");
  return guardar({ ...s, cerrado: null, resultado: null, motivoCierre: null });
}

/** Deja anotado que ya se avisó (o que ya venció), para no repetir el aviso. */
export async function marcarAviso(
  tenant: string,
  telefono: string,
  nivel: "aviso" | "vencido",
  detalle: string,
): Promise<void> {
  const s = await leerSolicitud(tenant, telefono);
  if (!s) return;
  const ahora = new Date().toISOString();
  await registrarEvento(tenant, telefono, nivel === "vencido" ? "vencido" : "aviso_gerente", "sistema", detalle);
  await guardar(nivel === "vencido" ? { ...s, escalado: ahora, avisado: s.avisado ?? ahora } : { ...s, avisado: ahora });
}

/** Lo que la tarjeta necesita para pintarse sin recalcular en tres lugares. */
export function resumenDe(s: Solicitud) {
  const etapa = etapaDe(s);
  const doc = detalleDocumentacion(s.expediente);
  return { etapa, sub: doc.sub, resumen: doc.resumen, aprobados: doc.aprobados, total: doc.total };
}
