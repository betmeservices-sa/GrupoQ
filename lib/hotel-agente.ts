// Herramientas del agente de IA del hotel. SOLO SERVIDOR.
//
// consultarDisponibilidadHotel  -> lee el PMS en vivo (disponibilidad y tarifas REALES)
// reservarHabitacionSimulada    -> guarda la reserva SOLO en el demo
//
// Ese segundo paso es a propósito: Cloudbeds sincroniza con el channel manager,
// así que crear la reserva de verdad bloquearía inventario en Booking y Expedia
// del hotel. El agente confirma al huésped con un número de reserva del demo
// (prefijo SIM-) y el panel la muestra marcada como simulada.

import {
  disponibilidadRango,
  hoyEnZona,
  listarTiposHabitacion,
  noches,
  obtenerPropiedad,
  hayPms,
} from "./cloudbeds";
import { crearReservaSimulada } from "./hotel-reservas";
import { invalidarCachePanel } from "./hotel-panel";

const ZONA_HOTEL = "America/Guatemala";

export interface InputDisponibilidadHotel {
  llegada?: string;
  salida?: string;
  adultos?: number;
  ninos?: number;
}

export interface OpcionHabitacion {
  habitacion: string;
  hasta_huespedes: number;
  noches: number;
  tarifa_por_noche: number;
  total_estadia: number;
  moneda: string;
}

// Normaliza fechas y valida el rango antes de gastar una llamada al PMS.
function rangoValido(
  input: InputDisponibilidadHotel,
  hoy: string,
): { ok: true; desde: string; hasta: string; n: number } | { ok: false; error: string } {
  const desde = (input.llegada ?? "").trim();
  const hasta = (input.salida ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return { ok: false, error: "Faltan las fechas de llegada y salida en formato AAAA-MM-DD." };
  }
  const n = noches(desde, hasta);
  if (n < 1) return { ok: false, error: "La salida tiene que ser al menos un día después de la llegada." };
  if (desde < hoy) return { ok: false, error: "La fecha de llegada ya pasó." };
  return { ok: true, desde, hasta, n };
}

export async function consultarDisponibilidadHotel(input: InputDisponibilidadHotel): Promise<{
  ok: boolean;
  llegada?: string;
  salida?: string;
  noches?: number;
  opciones?: OpcionHabitacion[];
  nota?: string;
  error?: string;
}> {
  if (!hayPms()) {
    return { ok: false, error: "No se puede consultar el sistema del hotel en este momento." };
  }

  const propiedad = await obtenerPropiedad();
  const hoy = hoyEnZona(propiedad?.zonaHoraria ?? ZONA_HOTEL);
  const rango = rangoValido(input, hoy);
  if (!rango.ok) return { ok: false, error: rango.error };

  const adultos = Math.max(1, Number(input.adultos) || 1);
  const ninos = Math.max(0, Number(input.ninos) || 0);

  const [tipos, libres] = await Promise.all([
    listarTiposHabitacion(),
    disponibilidadRango({ desde: rango.desde, hasta: rango.hasta, adultos, ninos }),
  ]);
  // null = el sistema no respondió. No se contesta "no hay nada": sería
  // decirle al huésped algo falso.
  if (libres === null) {
    return { ok: false, error: "No se pudo consultar la disponibilidad en este momento." };
  }
  const nombreDe = new Map(tipos.map((t) => [t.id, t]));
  const moneda = propiedad?.moneda ?? "USD";

  const opciones: OpcionHabitacion[] = libres
    .filter((l) => l.disponibles > 0 && l.tarifa > 0)
    .map((l) => {
      const t = nombreDe.get(l.id);
      return {
        habitacion: t?.nombre ?? l.id,
        hasta_huespedes: t?.maxHuespedes ?? 0,
        noches: rango.n,
        tarifa_por_noche: Math.round((l.tarifa / rango.n) * 100) / 100,
        total_estadia: l.tarifa,
        moneda,
      };
    })
    .sort((a, b) => a.total_estadia - b.total_estadia);

  return {
    ok: true,
    llegada: rango.desde,
    salida: rango.hasta,
    noches: rango.n,
    opciones,
    nota:
      opciones.length === 0
        ? "No hay habitaciones disponibles para esas fechas y ese número de personas."
        : "Ofrece SOLO estas habitaciones, con estas tarifas.",
  };
}

export interface InputReservaHotel {
  nombre?: string;
  habitacion?: string;
  llegada?: string;
  salida?: string;
  adultos?: number;
  ninos?: number;
  telefono?: string;
  // Quién la tomó: el agente por WhatsApp o alguien probándola desde el panel.
  origen?: "agente" | "panel";
}

// Empareja el nombre que dijo la IA con un tipo del PMS (exacto, sin acentos, o
// por contenido). Si no calza, se devuelve error en vez de inventar habitación.
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function reservarHabitacionSimulada(input: InputReservaHotel): Promise<{
  ok: boolean;
  reserva?: string;
  habitacion?: string;
  llegada?: string;
  salida?: string;
  noches?: number;
  total?: number;
  moneda?: string;
  error?: string;
}> {
  const nombre = (input.nombre ?? "").trim();
  if (!nombre) return { ok: false, error: "Falta el nombre completo del huésped." };

  const propiedad = await obtenerPropiedad();
  const hoy = hoyEnZona(propiedad?.zonaHoraria ?? ZONA_HOTEL);
  const rango = rangoValido(input, hoy);
  if (!rango.ok) return { ok: false, error: rango.error };

  const adultos = Math.max(1, Number(input.adultos) || 1);
  const ninos = Math.max(0, Number(input.ninos) || 0);

  // Se vuelve a consultar el PMS para no confirmar algo que ya no está libre ni
  // con una tarifa inventada: la que se guarda es la que devuelve el sistema.
  const [tipos, libres] = await Promise.all([
    listarTiposHabitacion(),
    disponibilidadRango({ desde: rango.desde, hasta: rango.hasta, adultos, ninos }),
  ]);
  if (libres === null) {
    return { ok: false, error: "No se pudo confirmar la disponibilidad en este momento." };
  }

  const pedida = normalizar(input.habitacion ?? "");
  const candidatos = tipos.filter((t) => libres.some((l) => l.id === t.id && l.disponibles > 0));
  const tipo =
    candidatos.find((t) => normalizar(t.nombre) === pedida) ??
    candidatos.find((t) => normalizar(t.nombre).includes(pedida) && pedida.length > 2) ??
    candidatos.find((t) => pedida.includes(normalizar(t.nombre)));

  if (!tipo) {
    return {
      ok: false,
      error: "Esa habitación ya no está disponible para esas fechas. Vuelve a consultar disponibilidad.",
    };
  }

  const tarifa = libres.find((l) => l.id === tipo.id)?.tarifa ?? 0;

  // ── AQUÍ TERMINA LO REAL ──
  // No se llama a postReservation ni a ningún endpoint de escritura del PMS.
  // La reserva queda solo en el demo (lib/hotel-reservas.ts).
  const reserva = crearReservaSimulada({
    huesped: nombre,
    telefono: input.telefono,
    tipoId: tipo.id,
    tipoNombre: tipo.nombre,
    desde: rango.desde,
    hasta: rango.hasta,
    adultos,
    ninos,
    tarifaTotal: tarifa,
    origen: input.origen ?? "agente",
  });
  invalidarCachePanel();

  return {
    ok: true,
    reserva: reserva.id,
    habitacion: tipo.nombre,
    llegada: rango.desde,
    salida: rango.hasta,
    noches: rango.n,
    total: tarifa,
    moneda: propiedad?.moneda ?? "USD",
  };
}

// Fecha de hoy en la zona del hotel, para el contexto temporal del prompt.
export function hoyHotel(): string {
  return hoyEnZona(ZONA_HOTEL);
}
