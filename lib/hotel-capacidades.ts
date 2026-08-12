// Lo que hoy NO está encendido, medido contra la cuenta real del hotel.
//
// Alimenta la sección de la pantalla del día que le muestra al dueño hasta dónde
// podría llegar esto sobre el mismo sistema que ya usa. Todo se lee; no se
// escribe ni se promete nada. Los números salen del sistema en vivo para que no
// se cuente una historia que no cuadre con su cuenta.

import {
  disponibilidadRango,
  formasDeCobro,
  hoyEnZona,
  listarTiposHabitacion,
  paisYZipDeLaPropiedad,
  sumarDias,
  type DireccionPropiedad,
  type FormaDeCobro,
} from "./cloudbeds";

export const ZONA_HOTEL = "America/Guatemala";

export interface Capacidades {
  // Habitaciones cargadas y cuántas de ellas puede vender hoy el sistema.
  tipos: number;
  conTarifa: number;
  sinTarifa: number;
  nochesConsultadas: string[];
  // Formas de pago cargadas en la cuenta (nombre tal cual las tiene el hotel).
  cobro: FormaDeCobro[];
  // País y código postal del alojamiento: los que llevaría la reserva el día que
  // se abra la escritura (no se le preguntan al huésped).
  direccion: DireccionPropiedad | null;
  avisos: string[];
  consultado: string;
}

/**
 * Un tipo de habitación "se puede vender" si el sistema lo devuelve en
 * disponibilidad, o sea si tiene tarifa activa. Se muestrean tres noches
 * separadas en vez de barrer dos semanas: alcanza para distinguir "sin tarifa"
 * de "ocupada esa noche" y cuesta tres consultas en vez de catorce.
 */
export function contarPublicables(
  tipos: Array<{ id: string }>,
  muestras: Array<Array<{ id: string }> | null>,
): { conTarifa: number; sinTarifa: number; leidas: number } {
  const con = new Set<string>();
  let leidas = 0;
  for (const m of muestras) {
    if (m === null) continue;
    leidas += 1;
    for (const t of m) con.add(t.id);
  }
  const conTarifa = tipos.filter((t) => con.has(t.id)).length;
  return { conTarifa, sinTarifa: tipos.length - conTarifa, leidas };
}

const TTL_MS = 30 * 60 * 1000;
let cache: { ts: number; datos: Capacidades } | null = null;

export function invalidarCacheCapacidades(): void {
  cache = null;
}

const SALTOS = [0, 5, 10];

export async function cargarCapacidades(): Promise<Capacidades> {
  if (cache && Date.now() - cache.ts < TTL_MS) return cache.datos;

  const hoy = hoyEnZona(ZONA_HOTEL);
  const fechas = SALTOS.map((d) => sumarDias(hoy, d));
  const avisos: string[] = [];

  const [tipos, cobro, direccion] = await Promise.all([
    listarTiposHabitacion(),
    formasDeCobro(),
    paisYZipDeLaPropiedad(),
  ]);

  const muestras = await Promise.all(
    fechas.map((f) => disponibilidadRango({ desde: f, hasta: sumarDias(f, 1) })),
  );

  const { conTarifa, sinTarifa, leidas } = contarPublicables(tipos, muestras);
  if (leidas === 0) avisos.push("No se pudo consultar qué habitaciones están a la venta.");
  if (!cobro.ok) avisos.push("No se pudieron consultar las formas de pago.");
  if (!direccion.ok) avisos.push("No se pudo consultar la dirección del alojamiento.");

  const datos: Capacidades = {
    tipos: tipos.length,
    conTarifa,
    sinTarifa,
    nochesConsultadas: fechas.filter((_, i) => muestras[i] !== null),
    cobro: cobro.ok ? cobro.datos : [],
    direccion: direccion.ok ? direccion.datos : null,
    avisos,
    consultado: new Date().toISOString(),
  };

  // Una lectura incompleta no se cachea media hora.
  cache = avisos.length === 0 && tipos.length > 0 ? { ts: Date.now(), datos } : null;
  return datos;
}
