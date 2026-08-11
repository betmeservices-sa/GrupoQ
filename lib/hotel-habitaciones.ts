// Estado de cada habitación para un rango de fechas concreto. SOLO SERVIDOR.
//
// Es lo que pinta la sección Habitaciones: una tarjeta por habitación con lo que
// el sistema del hotel dice de ella para esas noches. Todo sale de lectura
// (lib/cloudbeds.ts) más las reservas simuladas del demo; nada se escribe.

import {
  disponibilidadRango,
  listarTiposHabitacion,
  hoyEnZona,
  noches,
  obtenerPropiedad,
  type PropiedadPms,
} from "./cloudbeds";
import { tiposConTarifa } from "./hotel-panel";
import { solapeSimulado, type ReservaSimulada } from "./hotel-reservas";

export type EstadoHabitacion =
  | "libre"
  | "ocupada"
  | "simulada" // tomada por una reserva del demo
  | "sin_tarifa" // sin tarifa cargada: el sistema no la ofrece
  | "capacidad" // no admite ese número de huéspedes
  | "sin_dato"; // no se pudo leer, no se afirma nada

export interface HabitacionEstado {
  id: string;
  nombre: string;
  maxHuespedes: number;
  estado: EstadoHabitacion;
  tarifaNoche?: number;
  totalEstadia?: number;
  // Datos de la reserva del demo que la tiene tomada, si aplica.
  reservaSimulada?: { id: string; huesped: string; desde: string; hasta: string };
}

export interface VistaHabitaciones {
  propiedad: PropiedadPms | null;
  desde: string;
  hasta: string;
  noches: number;
  huespedes: number;
  hoy: string;
  habitaciones: HabitacionEstado[];
  resumen: Record<EstadoHabitacion, number>;
  consultado: string;
}

const ZONA_HOTEL = "America/Guatemala";

export function resumirEstados(habitaciones: HabitacionEstado[]): Record<EstadoHabitacion, number> {
  const r: Record<EstadoHabitacion, number> = {
    libre: 0,
    ocupada: 0,
    simulada: 0,
    sin_tarifa: 0,
    capacidad: 0,
    sin_dato: 0,
  };
  for (const h of habitaciones) r[h.estado] += 1;
  return r;
}

export interface EntradaHabitaciones {
  tipos: Array<{ id: string; nombre: string; maxHuespedes: number }>;
  // null = el sistema no respondió el rango. Nunca se traduce a "ocupada".
  libres: Array<{ id: string; tarifa: number; disponibles: number }> | null;
  // null = tampoco se pudo deducir qué tiene tarifa.
  conTarifa: Set<string> | null;
  simuladas: Array<ReservaSimulada | null>; // una por tipo, en el mismo orden
  huespedes: number;
  noches: number;
}

// Puro: decide el estado de cada habitación a partir de lo ya leído.
export function estadosDeHabitaciones(e: EntradaHabitaciones): HabitacionEstado[] {
  return e.tipos.map((tipo, i) => {
    const base = { id: tipo.id, nombre: tipo.nombre, maxHuespedes: tipo.maxHuespedes };

    // Sin lectura del rango no se afirma nada de ninguna habitación.
    if (e.libres === null) return { ...base, estado: "sin_dato" as const };

    if (e.conTarifa && !e.conTarifa.has(tipo.id)) {
      return { ...base, estado: "sin_tarifa" as const };
    }

    const tomada = e.simuladas[i];
    if (tomada) {
      return {
        ...base,
        estado: "simulada" as const,
        reservaSimulada: {
          id: tomada.id,
          huesped: tomada.huesped,
          desde: tomada.desde,
          hasta: tomada.hasta,
        },
      };
    }

    if (tipo.maxHuespedes > 0 && tipo.maxHuespedes < e.huespedes) {
      return { ...base, estado: "capacidad" as const };
    }

    const libre = e.libres.find((l) => l.id === tipo.id && l.disponibles > 0);
    if (libre) {
      return {
        ...base,
        estado: "libre" as const,
        tarifaNoche: e.noches > 0 ? Math.round((libre.tarifa / e.noches) * 100) / 100 : libre.tarifa,
        totalEstadia: libre.tarifa,
      };
    }

    // Falta en disponibilidad y no sabemos si tiene tarifa: no se adivina.
    if (!e.conTarifa) return { ...base, estado: "sin_dato" as const };
    return { ...base, estado: "ocupada" as const };
  });
}

export async function cargarHabitaciones(opts: {
  desde?: string;
  hasta?: string;
  huespedes?: number;
}): Promise<VistaHabitaciones> {
  const propiedad = await obtenerPropiedad();
  const hoy = hoyEnZona(propiedad?.zonaHoraria ?? ZONA_HOTEL);

  const desde = /^\d{4}-\d{2}-\d{2}$/.test(opts.desde ?? "") ? opts.desde! : hoy;
  const hastaPedida = /^\d{4}-\d{2}-\d{2}$/.test(opts.hasta ?? "") ? opts.hasta! : "";
  const n = hastaPedida ? noches(desde, hastaPedida) : 0;
  const hasta = n > 0 ? hastaPedida : sumarUnDia(desde);
  const nFinal = Math.max(1, n);
  const huespedes = Math.min(20, Math.max(1, Number(opts.huespedes) || 1));

  const [tipos, libres, conTarifa] = await Promise.all([
    listarTiposHabitacion(),
    disponibilidadRango({ desde, hasta, adultos: huespedes }),
    tiposConTarifa(),
  ]);

  const habitaciones = estadosDeHabitaciones({
    tipos,
    libres,
    conTarifa,
    simuladas: tipos.map((t) => solapeSimulado(t.id, desde, hasta)),
    huespedes,
    noches: nFinal,
  });

  return {
    propiedad,
    desde,
    hasta,
    noches: nFinal,
    huespedes,
    hoy,
    habitaciones,
    resumen: resumirEstados(habitaciones),
    consultado: new Date().toISOString(),
  };
}

function sumarUnDia(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}
