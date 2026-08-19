// Herramientas del agente de Yali Hospitality. SOLO SERVIDOR.
//
// consultarDisponibilidadYali -> lee el libro de ocupación de la sede
// reservarHabitacionYali      -> deja la reserva tomada en el demo
//
// La sede NO la adivina el modelo: sale de la pregunta de apertura, que el
// sistema ya resolvió antes de que la IA entrara a la conversación (ver
// lib/sucursal-gate.ts). Si por lo que sea no viniera, la herramienta la pide
// en vez de contestar sobre el hotel equivocado.

import { noches, sumarDias } from "./cloudbeds";
import {
  MONEDA_YALI,
  SEDES_YALI,
  sedePorId,
  type SedeYali,
} from "./tenants/yali-inventario";
import { cargarLibro, disponibilidad, hoyYali, type OpcionYali } from "./yali-pms";
import { crearReservaYali, solapeYali } from "./yali-reservas";

// Cuántos días de libro se cargan alrededor del rango consultado. Sobra para
// cualquier estadía de vacaciones y evita barrer un año entero por gusto.
const VENTANA_DIAS = 90;

export interface InputDisponibilidadYali {
  llegada?: string;
  salida?: string;
  adultos?: number;
  ninos?: number;
  sede?: string;
}

function resolverSede(input: InputDisponibilidadYali, sedeId?: string | null): SedeYali | null {
  if (sedeId) {
    const s = sedePorId(sedeId);
    if (s) return s;
  }
  const pedida = (input.sede ?? "").toLowerCase().trim();
  if (!pedida) return null;
  return (
    SEDES_YALI.find((s) => s.nombre.toLowerCase().includes(pedida)) ??
    SEDES_YALI.find((s) => pedida.includes(s.nombre.split(",")[0].toLowerCase())) ??
    null
  );
}

function rangoValido(
  input: InputDisponibilidadYali,
  hoy: string,
): { ok: true; desde: string; hasta: string; n: number } | { ok: false; error: string } {
  const desde = (input.llegada ?? "").trim();
  const hasta = (input.salida ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
    return { ok: false, error: "Faltan las fechas de llegada y salida en formato AAAA-MM-DD." };
  }
  const n = noches(desde, hasta);
  if (n < 1) {
    return { ok: false, error: "La salida tiene que ser al menos un día después de la llegada." };
  }
  if (desde < hoy) return { ok: false, error: "La fecha de llegada ya pasó." };
  return { ok: true, desde, hasta, n };
}

// Mientras el hotel no confirme su lista de precios, la tarifa se entrega con
// esta advertencia pegada: el agente puede cotizar, pero no puede presentarla
// como cerrada.
function notaTarifas(sede: SedeYali): string | undefined {
  if (sede.tarifasConfirmadas) return undefined;
  return "Estas tarifas son de referencia mientras el hotel termina de cargar su lista de precios. Puedes darlas, pero aclara en una frase corta que el equipo confirma el precio final.";
}

export async function consultarDisponibilidadYali(
  input: InputDisponibilidadYali,
  sedeId?: string | null,
): Promise<{
  ok: boolean;
  sede?: string;
  llegada?: string;
  salida?: string;
  noches?: number;
  opciones?: OpcionYali[];
  nota?: string;
  aviso_tarifas?: string;
  error?: string;
}> {
  const sede = resolverSede(input, sedeId);
  if (!sede) {
    return { ok: false, error: "Falta saber a cuál de los tres hoteles se refiere el huésped." };
  }
  const hoy = hoyYali();
  const rango = rangoValido(input, hoy);
  if (!rango.ok) return { ok: false, error: rango.error };

  const adultos = Math.max(1, Number(input.adultos) || 1);
  const ninos = Math.max(0, Number(input.ninos) || 0);
  const libro = cargarLibro(sumarDias(hoy, -3), VENTANA_DIAS);
  const opciones = disponibilidad(sede, libro, rango.desde, rango.hasta, adultos + ninos);

  return {
    ok: true,
    sede: sede.nombre,
    llegada: rango.desde,
    salida: rango.hasta,
    noches: rango.n,
    opciones,
    nota:
      opciones.length === 0
        ? "No hay habitaciones libres en esa sede para esas fechas y ese número de personas. Ofrece mover las fechas o revisar otra de nuestras sedes."
        : "Ofrece SOLO estas habitaciones, con estas tarifas.",
    aviso_tarifas: notaTarifas(sede),
  };
}

export interface InputReservaYali {
  nombre?: string;
  habitacion?: string;
  llegada?: string;
  salida?: string;
  adultos?: number;
  ninos?: number;
  sede?: string;
  telefono?: string;
  origen?: "agente" | "panel";
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Empareja el nombre que dijo la IA con un tipo de la sede. Nunca adivina. */
export function emparejarHabitacion<T extends { nombre: string }>(
  candidatas: T[],
  pedida: string,
): T | null {
  const p = normalizar(pedida);
  if (!p) return null;
  return (
    candidatas.find((h) => normalizar(h.nombre) === p) ??
    candidatas.find((h) => normalizar(h.nombre).includes(p) && p.length > 2) ??
    candidatas.find((h) => p.includes(normalizar(h.nombre))) ??
    null
  );
}

export async function reservarHabitacionYali(
  input: InputReservaYali,
  sedeId?: string | null,
): Promise<{
  ok: boolean;
  reserva?: string;
  sede?: string;
  habitacion?: string;
  llegada?: string;
  salida?: string;
  noches?: number;
  total?: number;
  moneda?: string;
  aviso_tarifas?: string;
  error?: string;
  motivo?: "datos" | "sede" | "desconocida" | "capacidad" | "ocupada";
}> {
  const nombre = (input.nombre ?? "").trim();
  if (!nombre) {
    return { ok: false, motivo: "datos", error: "Falta el nombre completo del huésped." };
  }
  const sede = resolverSede(input, sedeId);
  if (!sede) {
    return { ok: false, motivo: "sede", error: "Falta saber a cuál de los tres hoteles se refiere." };
  }
  const hoy = hoyYali();
  const rango = rangoValido(input, hoy);
  if (!rango.ok) return { ok: false, motivo: "datos", error: rango.error };

  const adultos = Math.max(1, Number(input.adultos) || 1);
  const ninos = Math.max(0, Number(input.ninos) || 0);

  const hab = emparejarHabitacion(sede.habitaciones, input.habitacion ?? "");
  if (!hab) {
    return {
      ok: false,
      motivo: "desconocida",
      error: `No encontramos esa habitación en ${sede.nombre}.`,
    };
  }
  if (hab.maxHuespedes < adultos + ninos) {
    return {
      ok: false,
      motivo: "capacidad",
      error: `${hab.nombre} admite hasta ${hab.maxHuespedes} ${hab.maxHuespedes === 1 ? "huésped" : "huéspedes"}.`,
    };
  }

  // Se vuelve a mirar el libro antes de confirmar: entre la cotización y el
  // "sí, resérvamela" pudo entrar otra reserva del demo sobre la misma unidad.
  const libro = cargarLibro(sumarDias(hoy, -3), VENTANA_DIAS);
  const libres = disponibilidad(sede, libro, rango.desde, rango.hasta, adultos + ninos);
  const sigueLibre = libres.find((o) => o.habitacion_id === hab.id);
  if (!sigueLibre) {
    return {
      ok: false,
      motivo: "ocupada",
      error: `${hab.nombre} ya no está libre en esas fechas.`,
    };
  }
  const choque = solapeYali(hab.id, rango.desde, rango.hasta);
  if (choque && hab.unidades <= 1) {
    return {
      ok: false,
      motivo: "ocupada",
      error: `${hab.nombre} ya está tomada del ${choque.desde} al ${choque.hasta}.`,
    };
  }

  const reserva = crearReservaYali({
    sedeId: sede.id,
    sedeNombre: sede.nombre,
    habitacionId: hab.id,
    habitacionNombre: hab.nombre,
    huesped: nombre,
    telefono: input.telefono,
    desde: rango.desde,
    hasta: rango.hasta,
    adultos,
    ninos,
    total: sigueLibre.total_estadia,
    origen: input.origen ?? "agente",
  });

  return {
    ok: true,
    reserva: reserva.id,
    sede: sede.nombre,
    habitacion: hab.nombre,
    llegada: rango.desde,
    salida: rango.hasta,
    noches: rango.n,
    total: sigueLibre.total_estadia,
    moneda: MONEDA_YALI,
    aviso_tarifas: notaTarifas(sede),
  };
}
