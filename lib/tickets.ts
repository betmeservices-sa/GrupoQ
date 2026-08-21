// Tickets: la gestión de lo que el agente NO resuelve solo.
//
// Sale de la reunión del 20 de agosto de 2026 con el hospital. El planteo de
// Helen y Roberto fue el mismo por caminos distintos: cuando Sofía transfiere,
// hoy se pierde el rastro. Nadie sabe si la persona atendió, cuánto tardó, ni
// si el caso quedó cerrado.
//
// Un ticket es ese rastro. Lo abre Sofía cuando el caso se le sale del guion,
// o lo abre a mano quien atiende en recepción a alguien que llegó caminando.
// De ahí en adelante tiene dueño, estado y reloj.

export type EstadoTicket = "abierto" | "asignado" | "en_proceso" | "resuelto";

export type OrigenTicket = "llamada" | "chat" | "manual" | "qr" | "correo";

/**
 * Para qué llamó. Roberto lo pidió por su nombre: sin tipificar no se puede
 * saber si las 30 solicitudes de la semana eran quejas o cotizaciones, que es
 * justo lo que hoy nadie sabe.
 */
export type TipoTicket =
  | "cotizacion"
  | "cita"
  | "resultados"
  | "facturacion"
  | "queja"
  | "informacion"
  | "emergencia"
  | "otro";

export type PrioridadTicket = "baja" | "normal" | "alta" | "urgente";

export interface NotaTicket {
  id: string;
  autor: string;
  texto: string;
  ts: string;
}

export interface Ticket {
  id: string;
  tenant: string;
  /** Consecutivo por tenant. Es el número que la gente dice en voz alta. */
  numero: number;
  titulo: string;
  detalle: string;
  tipo: TipoTicket;
  estado: EstadoTicket;
  prioridad: PrioridadTicket;
  origen: OrigenTicket;
  /** Quién lo abrió: "Sofía" o el nombre de la persona. */
  creadoPor: string;
  contactoNombre: string;
  contactoTelefono?: string;
  /** Departamento que debe resolverlo. */
  area: string;
  /** Id del staff que lo tiene. Vacío = nadie lo tomó todavía. */
  asignadoA?: string;
  /** Conversación de la que salió, si salió de una. */
  conversacionId?: string;
  creado: string;
  /** Cuándo alguien se hizo cargo. Corta el reloj de atención. */
  asignado?: string;
  /** Cuándo se cerró. Corta el reloj de resolución. */
  resuelto?: string;
  notas: NotaTicket[];
}

export interface TicketNuevo {
  titulo: string;
  detalle?: string;
  tipo: TipoTicket;
  prioridad?: PrioridadTicket;
  origen: OrigenTicket;
  creadoPor: string;
  contactoNombre: string;
  contactoTelefono?: string;
  area: string;
  asignadoA?: string;
  conversacionId?: string;
}

export const ESTADOS: { id: EstadoTicket; label: string; ayuda: string }[] = [
  { id: "abierto", label: "Sin tomar", ayuda: "Nadie se hizo cargo todavía" },
  { id: "asignado", label: "Asignado", ayuda: "Tiene dueño pero aún no lo trabaja" },
  { id: "en_proceso", label: "En proceso", ayuda: "Alguien lo está resolviendo ahora" },
  { id: "resuelto", label: "Resuelto", ayuda: "Cerrado, con su nota de qué pasó" },
];

export const TIPOS: { id: TipoTicket; label: string }[] = [
  { id: "cotizacion", label: "Cotización" },
  { id: "cita", label: "Cita" },
  { id: "resultados", label: "Resultados" },
  { id: "facturacion", label: "Facturación" },
  { id: "queja", label: "Queja" },
  { id: "informacion", label: "Información" },
  { id: "emergencia", label: "Emergencia" },
  { id: "otro", label: "Otro" },
];

export const PRIORIDADES: { id: PrioridadTicket; label: string }[] = [
  { id: "baja", label: "Baja" },
  { id: "normal", label: "Normal" },
  { id: "alta", label: "Alta" },
  { id: "urgente", label: "Urgente" },
];

export const ORIGENES: { id: OrigenTicket; label: string }[] = [
  { id: "llamada", label: "Llamada" },
  { id: "chat", label: "Chat" },
  { id: "manual", label: "Mostrador" },
  { id: "qr", label: "Código QR" },
  { id: "correo", label: "Correo" },
];

export const etiquetaEstado = (e: EstadoTicket) => ESTADOS.find((x) => x.id === e)?.label ?? e;
export const etiquetaTipo = (t: TipoTicket) => TIPOS.find((x) => x.id === t)?.label ?? t;
export const etiquetaOrigen = (o: OrigenTicket) => ORIGENES.find((x) => x.id === o)?.label ?? o;

/** Un ticket cuenta como pendiente mientras no esté resuelto. */
export const estaAbierto = (t: Ticket) => t.estado !== "resuelto";

/** Nadie lo tomó: es lo que hace cuello de botella y lo que hay que mirar primero. */
export const sinTomar = (t: Ticket) => t.estado === "abierto" && !t.asignadoA;

export function normalizarNuevo(t: TicketNuevo): TicketNuevo {
  return {
    titulo: t.titulo.trim(),
    detalle: (t.detalle ?? "").trim(),
    tipo: t.tipo,
    prioridad: t.prioridad ?? (t.tipo === "emergencia" ? "urgente" : "normal"),
    origen: t.origen,
    creadoPor: t.creadoPor.trim(),
    contactoNombre: t.contactoNombre.trim(),
    contactoTelefono: t.contactoTelefono?.trim() || undefined,
    area: t.area.trim(),
    asignadoA: t.asignadoA?.trim() || undefined,
    conversacionId: t.conversacionId?.trim() || undefined,
  };
}

/**
 * Orden de la cola: primero lo urgente, después lo más viejo.
 *
 * Roberto pidió ver "el más antiguo primero" y tiene razón para la cola normal,
 * pero una emergencia que entró hace un minuto no puede quedar debajo de una
 * cotización de ayer.
 */
const PESO: Record<PrioridadTicket, number> = { urgente: 0, alta: 1, normal: 2, baja: 3 };

export function ordenarCola(tickets: Ticket[]): Ticket[] {
  return [...tickets].sort((a, b) => {
    const p = PESO[a.prioridad] - PESO[b.prioridad];
    if (p !== 0) return p;
    return a.creado < b.creado ? -1 : a.creado > b.creado ? 1 : 0;
  });
}
