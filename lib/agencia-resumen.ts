// Lo que el tablero de la agencia cuenta de un cliente en el periodo elegido:
// las estadías que apartó el agente y los tickets.
//
// Antes estos bloques leían siempre los últimos 30 días y no se movían con el
// filtro de arriba: con "Hoy" el consumo cambiaba y la plata seguía igual.
//
// Puro, sin base ni reloj: el periodo llega ya cortado en hora de El Salvador
// (lib/periodos) y acá solo se filtra y se cuenta.

import type { Periodo } from "./periodos";

/** Los filtros del tablero de la agencia, en el orden en que se muestran. */
export const PERIODOS_AGENCIA: readonly Periodo[] = ["hoy", "ayer", "7d", "30d", "rango"];

/**
 * ¿`ts` cae en [desde, hasta)? Se compara la fecha y no el texto: la base
 * devuelve "+00:00" y el periodo viene con "Z", y como texto no ordenan igual.
 */
export function enRango(ts: string | null | undefined, desde: string, hasta: string): boolean {
  if (!ts) return false;
  const t = Date.parse(ts);
  return !Number.isNaN(t) && t >= Date.parse(desde) && t < Date.parse(hasta);
}

export interface Monto {
  n: number;
  total: number;
}

export interface ReservasDelPeriodo {
  confirmadas: Monto;
  pendientePago: Monto;
  conComprobante: Monto;
  /** Sin comprobante más por verificar: plata que todavía no entró. */
  esperando: Monto;
  rechazadas: number;
}

interface ReservaParaContar {
  estado: string;
  total?: number | null;
  creada: string;
}

/**
 * Las estadías apartadas en el periodo, por estado. Una estadía cuenta por el
 * día en que se apartó, con el estado que tiene hoy.
 */
export function reservasDelPeriodo(
  reservas: readonly ReservaParaContar[],
  desde: string,
  hasta: string,
): ReservasDelPeriodo {
  const delPeriodo = reservas.filter((r) => enRango(r.creada, desde, hasta));
  const porEstado = (estado: string): Monto => {
    const f = delPeriodo.filter((r) => r.estado === estado);
    return { n: f.length, total: Math.round(f.reduce((s, r) => s + (r.total ?? 0), 0)) };
  };
  const pendientePago = porEstado("pendiente_pago");
  const conComprobante = porEstado("comprobante_recibido");
  return {
    confirmadas: porEstado("confirmada"),
    pendientePago,
    conComprobante,
    esperando: {
      n: pendientePago.n + conComprobante.n,
      total: pendientePago.total + conComprobante.total,
    },
    rechazadas: porEstado("rechazada").n,
  };
}

/**
 * Las confirmadas del periodo, la más reciente primero. Con el MISMO corte que
 * reservasDelPeriodo: si no, "Quién cerró" y el bloque de la plata dan números
 * distintos para el mismo periodo.
 */
export function confirmadasDelPeriodo<T extends ReservaParaContar & { confirmadaTs?: string | null }>(
  reservas: readonly T[],
  desde: string,
  hasta: string,
): T[] {
  return reservas
    .filter((r) => r.estado === "confirmada" && enRango(r.creada, desde, hasta))
    .sort((a, b) => (b.confirmadaTs ?? b.creada).localeCompare(a.confirmadaTs ?? a.creada));
}

export interface TicketsDelPeriodo {
  /** Abiertos en el periodo. */
  periodo: number;
  abiertos: number;
  resueltos: number;
  porSofia: number;
  medianaMinutos: number | null;
  porTipo: { tipo: string; n: number }[];
}

interface TicketParaContar {
  creado: string;
  resuelto?: string;
  estado: string;
  creadoPor: string;
  tipo: string;
}

/** Los tickets que se abrieron en el periodo y en qué quedaron. */
export function ticketsDelPeriodo(
  tickets: readonly TicketParaContar[],
  desde: string,
  hasta: string,
): TicketsDelPeriodo {
  const delPeriodo = tickets.filter((k) => enRango(k.creado, desde, hasta));
  const minutos = delPeriodo
    .filter((k) => k.resuelto)
    .map((k) => (Date.parse(k.resuelto!) - Date.parse(k.creado)) / 60000)
    .filter((m) => m >= 0)
    .sort((a, b) => a - b);
  const porTipo = new Map<string, number>();
  for (const k of delPeriodo) porTipo.set(k.tipo, (porTipo.get(k.tipo) ?? 0) + 1);

  return {
    periodo: delPeriodo.length,
    abiertos: delPeriodo.filter((k) => k.estado !== "resuelto").length,
    resueltos: delPeriodo.filter((k) => k.estado === "resuelto").length,
    // El agente se guarda con su NOMBRE ("Sofía"), no con el id "ia".
    porSofia: delPeriodo.filter((k) => /^sof[ií]a$/i.test(k.creadoPor.trim())).length,
    medianaMinutos: minutos.length ? Math.round(minutos[Math.floor((minutos.length - 1) / 2)]) : null,
    porTipo: [...porTipo.entries()].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n),
  };
}
