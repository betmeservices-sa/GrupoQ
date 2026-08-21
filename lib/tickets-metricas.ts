// Las métricas de tickets que se pidieron en la reunión, una por una.
//
// Roberto: "en cuánto tiempo delegué la llamada y en cuánto tiempo después de
// delegada se resolvió". Son los dos relojes, y van separados a propósito: el
// primero mide la cola, el segundo mide a quien atiende. Un promedio único
// esconde cuál de los dos está fallando.
//
// Helen: "para saber cuál es la efectividad que tiene cada persona". De ahí la
// tabla por persona, y de ahí también que el reloj no corra de noche: sin eso,
// quien abre a las 7 arrastra las horas en que el hospital estuvo cerrado.
//
// Todos los tiempos son minutos HÁBILES (ver tickets-sla.ts).

import type { EstadoTicket, Ticket, TipoTicket } from "./tickets";
import { estaAbierto, sinTomar } from "./tickets";
import { HORARIO_HOSPITAL, type Horario, minutosHabiles } from "./tickets-sla";

export interface Periodo {
  desde: string;
  hasta: string;
}

export interface MetricaPersona {
  staffId: string;
  asignados: number;
  resueltos: number;
  abiertos: number;
  /** Promedio de resolución de los que cerró. null si no cerró ninguno. */
  promedioResolucion: number | null;
}

export interface MetricasTickets {
  total: number;
  abiertos: number;
  sinTomar: number;
  resueltos: number;
  /** Cola: de creado a tomado. null si nadie tomó ninguno todavía. */
  promedioAtencion: number | null;
  /** Persona: de tomado a cerrado. */
  promedioResolucion: number | null;
  /** El que lleva más tiempo hábil esperando que alguien lo agarre. */
  masEsperado: { ticket: Ticket; minutos: number } | null;
  porTipo: { tipo: TipoTicket; total: number; abiertos: number }[];
  porEstado: Record<EstadoTicket, number>;
  porPersona: MetricaPersona[];
  /**
   * Resueltos sin que ninguna persona los tocara, sobre el total.
   *
   * Es el "first call resolution" que nombró Roberto, adaptado: acá el ticket
   * existe justamente porque Sofía NO pudo cerrarlo sola, así que esto mide
   * cuántos igual se cerraron sin intervención humana (un recordatorio, una
   * confirmación automática). Cuanto más alto, menos carga para el equipo.
   */
  resueltosSinPersona: number;
}

const promedio = (xs: number[]): number | null =>
  xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null;

const dentro = (iso: string, p?: Periodo) => !p || (iso >= p.desde && iso <= p.hasta);

/** Minutos hábiles que un ticket estuvo en la cola, antes de que lo tomaran. */
export function tiempoAtencion(t: Ticket, horario: Horario = HORARIO_HOSPITAL, ahora?: string): number {
  const fin = t.asignado ?? ahora ?? new Date().toISOString();
  return minutosHabiles(t.creado, fin, horario);
}

/**
 * Minutos hábiles desde que alguien lo tomó hasta que lo cerró.
 *
 * Si nadie lo tomó, no hay tiempo de resolución que medir: devuelve null en vez
 * de cero, porque cero se leería como "lo resolvió al instante" y sería lo
 * contrario de la verdad.
 */
export function tiempoResolucion(
  t: Ticket,
  horario: Horario = HORARIO_HOSPITAL,
  ahora?: string,
): number | null {
  if (!t.asignado) return null;
  const fin = t.resuelto ?? ahora ?? new Date().toISOString();
  return minutosHabiles(t.asignado, fin, horario);
}

export function calcularMetricas(
  tickets: Ticket[],
  opciones: { horario?: Horario; periodo?: Periodo; ahora?: string } = {},
): MetricasTickets {
  const horario = opciones.horario ?? HORARIO_HOSPITAL;
  const ahora = opciones.ahora ?? new Date().toISOString();
  const enPeriodo = tickets.filter((t) => dentro(t.creado, opciones.periodo));

  const abiertos = enPeriodo.filter(estaAbierto);
  const resueltos = enPeriodo.filter((t) => t.estado === "resuelto");
  const enCola = enPeriodo.filter(sinTomar);

  // Atención: solo los que YA fueron tomados. Meter los que siguen en cola
  // subiría el promedio cada minuto que pasa y volvería el número inútil para
  // comparar semanas.
  const atenciones = enPeriodo
    .filter((t) => t.asignado)
    .map((t) => minutosHabiles(t.creado, t.asignado as string, horario));

  const resoluciones = resueltos
    .map((t) => tiempoResolucion(t, horario, ahora))
    .filter((x): x is number => x !== null);

  // El que más espera se busca entre los que nadie tomó: es el que puede
  // convertirse en la queja de mañana.
  let masEsperado: MetricasTickets["masEsperado"] = null;
  for (const t of enCola) {
    const min = minutosHabiles(t.creado, ahora, horario);
    if (!masEsperado || min > masEsperado.minutos) masEsperado = { ticket: t, minutos: min };
  }

  const tipos = new Map<TipoTicket, { total: number; abiertos: number }>();
  for (const t of enPeriodo) {
    const f = tipos.get(t.tipo) ?? { total: 0, abiertos: 0 };
    f.total += 1;
    if (estaAbierto(t)) f.abiertos += 1;
    tipos.set(t.tipo, f);
  }

  const porEstado: Record<EstadoTicket, number> = {
    abierto: 0,
    asignado: 0,
    en_proceso: 0,
    resuelto: 0,
  };
  for (const t of enPeriodo) porEstado[t.estado] += 1;

  const personas = new Map<string, { asignados: number; resueltos: number; abiertos: number; tiempos: number[] }>();
  for (const t of enPeriodo) {
    if (!t.asignadoA) continue;
    const f = personas.get(t.asignadoA) ?? { asignados: 0, resueltos: 0, abiertos: 0, tiempos: [] };
    f.asignados += 1;
    if (t.estado === "resuelto") {
      f.resueltos += 1;
      const min = tiempoResolucion(t, horario, ahora);
      if (min !== null) f.tiempos.push(min);
    } else {
      f.abiertos += 1;
    }
    personas.set(t.asignadoA, f);
  }

  return {
    total: enPeriodo.length,
    abiertos: abiertos.length,
    sinTomar: enCola.length,
    resueltos: resueltos.length,
    promedioAtencion: promedio(atenciones),
    promedioResolucion: promedio(resoluciones),
    masEsperado,
    porTipo: [...tipos.entries()]
      .map(([tipo, f]) => ({ tipo, ...f }))
      .sort((a, b) => b.total - a.total),
    porEstado,
    porPersona: [...personas.entries()]
      .map(([staffId, f]) => ({
        staffId,
        asignados: f.asignados,
        resueltos: f.resueltos,
        abiertos: f.abiertos,
        promedioResolucion: promedio(f.tiempos),
      }))
      .sort((a, b) => b.resueltos - a.resueltos),
    resueltosSinPersona: resueltos.filter((t) => !t.asignadoA).length,
  };
}

/** Los últimos N días completos, para los filtros del panel. */
export function ultimosDias(n: number, ahora = new Date()): Periodo {
  const hasta = new Date(ahora);
  const desde = new Date(ahora.getTime() - n * 86_400_000);
  return { desde: desde.toISOString(), hasta: hasta.toISOString() };
}
