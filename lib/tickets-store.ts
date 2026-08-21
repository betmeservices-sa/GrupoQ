// Persistencia de tickets. Tabla `tickets` en Supabase cuando hay env y la
// tabla existe; si no, memoria del proceso, igual que el resto de stores.
//
// OJO con el modo memoria en producción: el panel y el webhook de WhatsApp son
// funciones serverless distintas y cada una tiene su memoria. Sin la tabla, un
// ticket que abre Sofía desde el webhook puede no verlo el panel. Por eso va la
// migración (supabase/migrations/20260821000000_tickets.sql) y el panel avisa
// mientras esté guardando en memoria.

import { getSupabase } from "./supabase";
import { columnaFaltante, latchDeTabla, tablaFaltante } from "./tabla-faltante";
import type { EstadoTicket, NotaTicket, Ticket, TicketNuevo } from "./tickets";
import { normalizarNuevo } from "./tickets";
import { ticketsSemilla } from "./tickets-seed";

const COLS =
  "id, tenant, numero, titulo, detalle, tipo, estado, prioridad, origen, creado_por, contacto_nombre, contacto_telefono, area, asignado_a, conversacion_id, creado, asignado, resuelto, notas";

const mem = new Map<string, Ticket>();
const sembrado = new Set<string>();
const faltaTabla = latchDeTabla();

/** true si estamos guardando solo en memoria (lo pinta el panel como aviso). */
export function ticketsEnMemoria(): boolean {
  return getSupabase() === null || faltaTabla.activo();
}

/** true si hay base pero le falta la migración (el aviso es distinto). */
export function ticketsSinTabla(): boolean {
  return getSupabase() !== null && faltaTabla.activo();
}

// ── Traducción a la tabla ────────────────────────────────────────────────────
// La base usa snake_case y el código camelCase. La conversión vive acá y en un
// solo lugar, para que un cambio de columna no obligue a tocar la UI.

type Fila = Record<string, unknown>;

function aFila(t: Ticket): Fila {
  return {
    id: t.id,
    tenant: t.tenant,
    numero: t.numero,
    titulo: t.titulo,
    detalle: t.detalle,
    tipo: t.tipo,
    estado: t.estado,
    prioridad: t.prioridad,
    origen: t.origen,
    creado_por: t.creadoPor,
    contacto_nombre: t.contactoNombre,
    contacto_telefono: t.contactoTelefono ?? null,
    area: t.area,
    asignado_a: t.asignadoA ?? null,
    conversacion_id: t.conversacionId ?? null,
    creado: t.creado,
    asignado: t.asignado ?? null,
    resuelto: t.resuelto ?? null,
    notas: t.notas,
  };
}

function deFila(f: Fila): Ticket {
  return {
    id: String(f.id),
    tenant: String(f.tenant),
    numero: Number(f.numero ?? 0),
    titulo: String(f.titulo ?? ""),
    detalle: String(f.detalle ?? ""),
    tipo: (f.tipo ?? "otro") as Ticket["tipo"],
    estado: (f.estado ?? "abierto") as EstadoTicket,
    prioridad: (f.prioridad ?? "normal") as Ticket["prioridad"],
    origen: (f.origen ?? "manual") as Ticket["origen"],
    creadoPor: String(f.creado_por ?? ""),
    contactoNombre: String(f.contacto_nombre ?? ""),
    contactoTelefono: (f.contacto_telefono as string) ?? undefined,
    area: String(f.area ?? ""),
    asignadoA: (f.asignado_a as string) ?? undefined,
    conversacionId: (f.conversacion_id as string) ?? undefined,
    creado: String(f.creado),
    asignado: (f.asignado as string) ?? undefined,
    resuelto: (f.resuelto as string) ?? undefined,
    // `notas` es jsonb. Si viniera nulo o con basura, un arreglo vacío es mejor
    // que reventar la página entera del ticket.
    notas: Array.isArray(f.notas) ? (f.notas as NotaTicket[]) : [],
  };
}

// ── Memoria ──────────────────────────────────────────────────────────────────

/**
 * La primera lectura de un tenant siembra el tablero.
 *
 * Sin esto el demo abre vacío, y un tablero de tickets vacío no se puede
 * mostrar en una reunión: no se ve la cola, ni los promedios, ni el que lleva
 * más tiempo esperando, que es justo lo que se quiere enseñar.
 */
function deMemoria(tenant: string): Ticket[] {
  if (!sembrado.has(tenant)) {
    sembrado.add(tenant);
    for (const t of ticketsSemilla(tenant)) mem.set(t.id, t);
  }
  return [...mem.values()].filter((t) => t.tenant === tenant);
}

function nuevoId(): string {
  return `tkt-${Math.random().toString(36).slice(2, 10)}`;
}

// ── Lectura ──────────────────────────────────────────────────────────────────

export async function listarTickets(tenant: string): Promise<Ticket[]> {
  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) return deMemoria(tenant);

  const { data, error } = await sb
    .from("tickets")
    .select(COLS)
    .eq("tenant", tenant)
    .order("creado", { ascending: false });
  if (error) {
    if (tablaFaltante(error) || columnaFaltante(error)) {
      faltaTabla.marcar();
      return deMemoria(tenant);
    }
    // Un error de lectura NO se convierte en "no hay tickets": eso haría creer
    // que la cola está limpia cuando puede estar llena. Se propaga.
    throw new Error(error.message);
  }
  return (data ?? []).map((f) => deFila(f as Fila));
}

export async function obtenerTicket(tenant: string, id: string): Promise<Ticket | null> {
  const todos = await listarTickets(tenant);
  return todos.find((t) => t.id === id) ?? null;
}

// ── Escritura ────────────────────────────────────────────────────────────────

async function siguienteNumero(tenant: string): Promise<number> {
  const todos = await listarTickets(tenant);
  return todos.reduce((max, t) => Math.max(max, t.numero), 0) + 1;
}

export async function crearTicket(tenant: string, entrada: TicketNuevo): Promise<Ticket> {
  const base = normalizarNuevo(entrada);
  const ahora = new Date().toISOString();
  const ticket: Ticket = {
    id: nuevoId(),
    tenant,
    numero: await siguienteNumero(tenant),
    titulo: base.titulo,
    detalle: base.detalle ?? "",
    tipo: base.tipo,
    // Si nace con dueño, nace asignado: el reloj de cola no debe correr para un
    // ticket que alguien ya tomó en el mismo acto de crearlo.
    estado: base.asignadoA ? "asignado" : "abierto",
    prioridad: base.prioridad ?? "normal",
    origen: base.origen,
    creadoPor: base.creadoPor,
    contactoNombre: base.contactoNombre,
    contactoTelefono: base.contactoTelefono,
    area: base.area,
    asignadoA: base.asignadoA,
    conversacionId: base.conversacionId,
    creado: ahora,
    asignado: base.asignadoA ? ahora : undefined,
    notas: [],
  };

  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) {
    mem.set(ticket.id, ticket);
    return ticket;
  }
  const { error } = await sb.from("tickets").insert(aFila(ticket));
  if (error) {
    if (tablaFaltante(error) || columnaFaltante(error)) {
      faltaTabla.marcar();
      mem.set(ticket.id, ticket);
      return ticket;
    }
    throw new Error(error.message);
  }
  return ticket;
}

async function guardar(t: Ticket): Promise<Ticket> {
  const sb = getSupabase();
  if (!sb || faltaTabla.activo()) {
    mem.set(t.id, t);
    return t;
  }
  const { error } = await sb.from("tickets").update(aFila(t)).eq("id", t.id).eq("tenant", t.tenant);
  if (error) {
    if (tablaFaltante(error) || columnaFaltante(error)) {
      faltaTabla.marcar();
      mem.set(t.id, t);
      return t;
    }
    throw new Error(error.message);
  }
  return t;
}

/**
 * Asignar. Sella la hora la PRIMERA vez nada más.
 *
 * Reasignar un ticket a otra persona no puede volver a arrancar el reloj de
 * cola: el paciente ya fue atendido, y si se reseteara, pasarse un ticket entre
 * compañeros haría que el tiempo de espera se vea siempre bajo.
 */
export async function asignarTicket(tenant: string, id: string, staffId: string): Promise<Ticket | null> {
  const t = await obtenerTicket(tenant, id);
  if (!t) return null;
  const ahora = new Date().toISOString();
  return guardar({
    ...t,
    asignadoA: staffId || undefined,
    asignado: t.asignado ?? (staffId ? ahora : undefined),
    estado: t.estado === "abierto" && staffId ? "asignado" : t.estado,
  });
}

export async function cambiarEstado(tenant: string, id: string, estado: EstadoTicket): Promise<Ticket | null> {
  const t = await obtenerTicket(tenant, id);
  if (!t) return null;
  const ahora = new Date().toISOString();
  return guardar({
    ...t,
    estado,
    // Tomarlo también sella la hora de atención, aunque se haga desde el
    // selector de estado y no desde el de persona.
    asignado: t.asignado ?? (estado !== "abierto" ? ahora : undefined),
    // Reabrir borra la hora de cierre: si no, el ticket quedaría abierto y con
    // fecha de resolución, y el promedio contaría un cierre que se deshizo.
    resuelto: estado === "resuelto" ? (t.resuelto ?? ahora) : undefined,
  });
}

export async function agregarNota(
  tenant: string,
  id: string,
  autor: string,
  texto: string,
): Promise<Ticket | null> {
  const limpio = texto.trim();
  if (!limpio) return obtenerTicket(tenant, id);
  const t = await obtenerTicket(tenant, id);
  if (!t) return null;
  const nota: NotaTicket = {
    id: `nota-${Math.random().toString(36).slice(2, 8)}`,
    autor: autor.trim() || "Sin nombre",
    texto: limpio,
    ts: new Date().toISOString(),
  };
  return guardar({ ...t, notas: [...t.notas, nota] });
}

/** Solo para las pruebas: deja el store como recién arrancado. */
export function _resetTicketsMem() {
  mem.clear();
  sembrado.clear();
}
