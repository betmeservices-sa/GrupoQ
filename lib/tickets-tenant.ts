// Qué significa un ticket en cada negocio.
//
// El motor es el mismo (cola, dos relojes, notas, métricas), pero lo que se
// tipifica y quién lo resuelve cambia por completo: un hospital clasifica por
// especialidad y un hotel por sede. Meterlo todo en una sola lista habría hecho
// que el hotel viera "Resultados de laboratorio" en su desplegable.
//
// El horario también es del negocio, y no es un detalle: es el reloj con el que
// se mide a la gente. Un hospital cierra y un hotel de playa no.

import type { TipoTicket } from "./tickets";
import {
  HORARIO_CONTINUO,
  HORARIO_HOSPITAL,
  horarioDiario,
  type Horario,
} from "./tickets-sla";

export interface AreaTicket {
  id: string;
  label: string;
  /**
   * Horario propio del área, cuando no es el del negocio.
   *
   * Salió del kickoff de Yali: la línea de reservas atiende de 8 a 5, la de
   * membresías de 9 a 8 y las sedes no cierran nunca. Medir a las tres contra
   * el mismo reloj haría que a quien atiende reservas le cuenten en contra las
   * quince horas en que no le tocaba estar.
   */
  horario?: Horario;
}

export interface ConfigTickets {
  /** Los tipos que ese negocio de verdad recibe, en el orden en que los ve. */
  tipos: TipoTicket[];
  areas: AreaTicket[];
  /** Horario del negocio. Es el default de las áreas que no traen el suyo. */
  horario: Horario;
  /** A qué área cae un ticket cuando el agente no logra decidir. */
  areaPorDefecto: string;
}

const HOSPITAL: ConfigTickets = {
  tipos: ["cotizacion", "cita", "resultados", "facturacion", "queja", "informacion", "emergencia", "otro"],
  areas: [
    { id: "atencion", label: "Atención al cliente" },
    { id: "ventas", label: "Ventas" },
    { id: "recepcion", label: "Recepción" },
    { id: "laboratorio", label: "Laboratorio" },
    { id: "imagenes", label: "Imágenes" },
    { id: "caja", label: "Caja y facturación" },
    { id: "ginecologia", label: "Ginecología" },
  ],
  horario: HORARIO_HOSPITAL,
  areaPorDefecto: "atencion",
};

/**
 * Yali Hospitality: tres hoteles de playa. Kickoff del 24 de agosto de 2026.
 *
 * Las áreas son las personas reales que reciben el ticket, no departamentos
 * inventados. En la llamada quedó dicho quién atiende qué:
 *   - Reservas (Verónica) ve todo lo de habitaciones y pagos, de 8 a 5.
 *   - Membresías (Olga) ve TODO lo del Sunsal Beach Club, de 9 a 8. Jaime lo
 *     puso así: "reservas es la banca tradicional y membresía es banca privada";
 *     nadie más habla de precios de socio.
 *   - Las tres sedes reciben lo que pasa dentro del hotel (un aire que no
 *     enfría, algo olvidado) y no cierran: el vigilante está siempre.
 */
const YALI: ConfigTickets = {
  tipos: [
    "reserva",
    "pago",
    "membresia",
    "queja",
    "objeto_perdido",
    "mantenimiento",
    "checkin_especial",
    "cotizacion",
    "informacion",
    "otro",
  ],
  areas: [
    // 8 a 5, los siete días: el sábado es justamente su día más cargado.
    { id: "reservas", label: "Reservas (Verónica)", horario: horarioDiario(8, 17) },
    // Olga contesta a toda hora, pero lo que comunican es de 9 a 8. Se mide
    // contra lo que se promete, no contra lo que ella aguanta.
    { id: "membresias", label: "Membresías (Olga)", horario: horarioDiario(9, 20) },
    { id: "yali", label: "Sede Yalí" },
    { id: "surf", label: "Sede Costa del Surf" },
    { id: "linda", label: "Sede Playa Linda" },
    { id: "gerencia", label: "Gerencia", horario: horarioDiario(8, 17) },
  ],
  // Default del negocio: las sedes no cierran.
  horario: HORARIO_CONTINUO,
  areaPorDefecto: "reservas",
};

const POR_TENANT: Record<string, ConfigTickets> = { hospital: HOSPITAL, yaly: YALI };

export function configTickets(tenant: string): ConfigTickets {
  return POR_TENANT[tenant] ?? HOSPITAL;
}

/** ¿Este cliente tiene tablero de tickets? */
export function veTickets(tenant: string): boolean {
  return tenant in POR_TENANT;
}

/**
 * El reloj con el que se mide UN ticket, según a qué área cayó.
 *
 * Si el área no existe (se renombró, o el ticket viene de un seed viejo) cae al
 * horario del negocio en vez de romper: un ticket mal etiquetado tiene que
 * seguir contando, aunque cuente contra el reloj equivocado.
 */
export function horarioDeArea(tenant: string, areaId?: string): Horario {
  const cfg = configTickets(tenant);
  const area = cfg.areas.find((a) => a.id === areaId);
  return area?.horario ?? cfg.horario;
}

export const etiquetaArea = (tenant: string, areaId: string): string =>
  configTickets(tenant).areas.find((a) => a.id === areaId)?.label ?? areaId;

/**
 * A qué área cae un ticket que abre Sofía en Yali.
 *
 * El ruteo sale del kickoff, no de una taxonomía: membresías es de Olga y de
 * nadie más, todo lo que huela a habitación o a dinero es de reservas, y lo
 * que pasa DENTRO del hotel (algo olvidado, algo que no sirve) es de la sede,
 * porque nadie de Yalí puede ir a buscar una toalla a Costa del Surf.
 *
 * `sedeId` es la letra con la que el huésped eligió hotel (a, b o c).
 */
export function areaYaliPara(tipo: TipoTicket, sedeId?: string | null): string {
  if (tipo === "membresia") return "membresias";
  if (tipo === "objeto_perdido" || tipo === "mantenimiento") {
    return SEDE_POR_LETRA[sedeId ?? ""] ?? "reservas";
  }
  // Una queja de quien está adentro la atiende la sede; si no sabemos de cuál
  // hotel escribe, reservas la reparte.
  if (tipo === "queja") return SEDE_POR_LETRA[sedeId ?? ""] ?? "reservas";
  return "reservas";
}

const SEDE_POR_LETRA: Record<string, string> = { a: "yali", b: "surf", c: "linda" };

/** "8:00", "17:00". Minutos desde la medianoche, como los guarda el horario. */
function reloj(min: number): string {
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

function ventana(h: Horario): string {
  const dia = h.dias.find(Boolean);
  if (!dia) return "sin horario";
  if (dia.abre === 0 && dia.cierra === 24 * 60) return "a reloj corrido";
  return `de ${reloj(dia.abre)} a ${reloj(dia.cierra)}`;
}

/**
 * La frase que explica, en el panel, con qué reloj se está midiendo.
 *
 * Se arma desde la configuración a propósito. Antes era un texto escrito a mano
 * que decía "acá no se cierra", y en cuanto Yali pasó a tener áreas con horario
 * propio quedó diciendo una mentira sobre sus propios números.
 */
export function explicacionReloj(tenant: string): string {
  const cfg = configTickets(tenant);
  const propias = cfg.areas.filter((a) => a.horario);

  if (propias.length === 0) {
    return cfg.horario === HORARIO_CONTINUO
      ? "Los tiempos son de reloj corrido: acá no se cierra, así que un ticket que entra a las 2 de la mañana está corriendo desde las 2 de la mañana."
      : "Los tiempos cuentan solo horas hábiles (lunes a viernes de 7 a 19, sábados de 8 a 13). Un ticket que entra a las 2 de la mañana y se resuelve a las 8:15 tardó 15 minutos, no seis horas.";
  }

  const detalle = propias.map((a) => `${a.label} ${ventana(a.horario as Horario)}`).join(", ");
  const resto =
    cfg.horario === HORARIO_CONTINUO
      ? "y el resto a reloj corrido, porque el hotel no cierra"
      : `y el resto ${ventana(cfg.horario)}`;
  return `Cada área se mide con su propio horario: ${detalle}, ${resto}. Un caso que entra a medianoche no le cuenta en contra a quien no estaba de turno.`;
}
