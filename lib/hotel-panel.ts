// Panel de ocupación del hotel: arma lo que pinta el dashboard a partir de la
// lectura del PMS (lib/cloudbeds.ts) más las reservas simuladas del demo
// (lib/hotel-reservas.ts). SOLO SERVIDOR: aquí se toca la API key.
//
// `construirPanel` es pura (recibe los datos ya leídos) para poder probarla sin
// red; `cargarPanel` es la que habla con el PMS y cachea.

import {
  disponibilidadRango,
  enTandas,
  hoyEnZona,
  listarReservas,
  listarTiposHabitacion,
  obtenerPropiedad,
  sumarDias,
  type NochePms,
  type PropiedadPms,
  type ReservaPms,
  type TipoHabitacion,
} from "./cloudbeds";
import { listarReservasSimuladas, nochesDe, type ReservaSimulada } from "./hotel-reservas";

// "sin_dato" = el sistema no respondió esa noche. Se pinta aparte y no suma
// ocupación: dar por ocupada una noche que no se pudo leer sería inventar.
export type EstadoNoche = "libre" | "ocupada" | "simulada" | "sin_tarifa" | "sin_dato";

export interface CeldaNoche {
  fecha: string;
  estado: EstadoNoche;
  tarifa?: number;
}

export interface FilaHabitacion {
  id: string;
  nombre: string;
  maxHuespedes: number;
  // Reservable = el PMS la devuelve en disponibilidad, o sea tiene tarifa activa.
  reservable: boolean;
  tarifaNoche?: number;
  noches: CeldaNoche[];
}

export interface KpisHotel {
  tipos: number;
  reservables: number;
  sinTarifa: number;
  ocupadasHoy: number;
  libresHoy: number;
  ocupacionHoyPct: number;
  nochesOcupadas: number;
  nochesVendibles: number;
  saldoPorCobrar: number;
  reservasPms: number;
  reservasSimuladas: number;
  // Noches que el sistema no devolvió; quedan fuera de todos los cálculos.
  nochesSinDato: number;
}

export interface PanelHotel {
  propiedad: PropiedadPms | null;
  hoy: string;
  dias: number;
  fechas: string[];
  filas: FilaHabitacion[];
  kpis: KpisHotel;
  reservas: ReservaPms[];
  simuladas: ReservaSimulada[];
  consultado: string; // ISO 8601
  error?: string;
}

export interface EntradaPanel {
  propiedad: PropiedadPms | null;
  tipos: TipoHabitacion[];
  noches: NochePms[]; // una entrada por noche, en orden
  reservas: ReservaPms[];
  simuladas: ReservaSimulada[];
  hoy: string;
}

export function construirPanel(e: EntradaPanel): PanelHotel {
  const fechas = e.noches.map((n) => n.fecha);

  // Qué tipos aparecen alguna noche en disponibilidad: esos son los que tienen
  // tarifa activa. Los que no aparecen NUNCA en la ventana no son vendibles (así
  // se comporta getAvailableRoomTypes: sin tarifa, no los devuelve).
  const conTarifa = new Set<string>();
  const tarifaDe = new Map<string, number>();
  for (const noche of e.noches) {
    for (const t of noche.tipos ?? []) {
      conTarifa.add(t.id);
      if (!tarifaDe.has(t.id) && t.tarifa > 0) tarifaDe.set(t.id, t.tarifa);
    }
  }
  // Noches que sí se pudieron leer: solo esas entran en los cálculos.
  const leidas = e.noches.filter((n) => n.tipos !== null).length;

  // Noches que bloquea cada tipo por una reserva simulada del demo.
  const simuladasPorTipo = new Map<string, Set<string>>();
  for (const r of e.simuladas) {
    let set = simuladasPorTipo.get(r.tipoId);
    if (!set) {
      set = new Set<string>();
      simuladasPorTipo.set(r.tipoId, set);
    }
    for (const f of nochesDe(r)) set.add(f);
  }

  const filas: FilaHabitacion[] = e.tipos.map((tipo) => {
    const reservable = conTarifa.has(tipo.id);
    const celdas: CeldaNoche[] = e.noches.map((noche) => {
      if (!reservable) return { fecha: noche.fecha, estado: "sin_tarifa" as const };
      if (simuladasPorTipo.get(tipo.id)?.has(noche.fecha)) {
        return { fecha: noche.fecha, estado: "simulada" as const };
      }
      if (noche.tipos === null) return { fecha: noche.fecha, estado: "sin_dato" as const };
      const libre = noche.tipos.find((t) => t.id === tipo.id && t.disponibles > 0);
      return libre
        ? { fecha: noche.fecha, estado: "libre" as const, tarifa: libre.tarifa }
        : { fecha: noche.fecha, estado: "ocupada" as const };
    });
    return {
      id: tipo.id,
      nombre: tipo.nombre,
      maxHuespedes: tipo.maxHuespedes,
      reservable,
      tarifaNoche: tarifaDe.get(tipo.id),
      noches: celdas,
    };
  });

  const reservables = filas.filter((f) => f.reservable);
  const hoySeLeyo = e.noches[0]?.tipos !== null && e.noches.length > 0;
  const ocupadasHoy = hoySeLeyo
    ? reservables.filter((f) => f.noches[0].estado === "ocupada" || f.noches[0].estado === "simulada")
        .length
    : 0;
  const nochesVendibles = reservables.length * leidas;
  const nochesOcupadas = reservables.reduce(
    (n, f) => n + f.noches.filter((c) => c.estado === "ocupada" || c.estado === "simulada").length,
    0,
  );

  return {
    propiedad: e.propiedad,
    hoy: e.hoy,
    dias: e.noches.length,
    fechas,
    filas,
    kpis: {
      tipos: e.tipos.length,
      reservables: reservables.length,
      sinTarifa: e.tipos.length - reservables.length,
      ocupadasHoy,
      libresHoy: reservables.length - ocupadasHoy,
      ocupacionHoyPct:
        reservables.length === 0 ? 0 : Math.round((ocupadasHoy / reservables.length) * 100),
      nochesOcupadas,
      nochesVendibles,
      saldoPorCobrar: e.reservas.reduce((s, r) => s + (r.saldo > 0 ? r.saldo : 0), 0),
      reservasPms: e.reservas.length,
      reservasSimuladas: e.simuladas.length,
      nochesSinDato: (e.noches.length - leidas) * reservables.length,
    },
    reservas: e.reservas,
    simuladas: e.simuladas,
    consultado: new Date().toISOString(),
  };
}

// Caché corta: el panel se recarga solo cada vez que se abre el dashboard y no
// tiene sentido barrer 14 noches del PMS en cada visita.
const TTL_MS = 3 * 60 * 1000;
let cache: { clave: string; ts: number; datos: Omit<EntradaPanel, "simuladas"> } | null = null;

async function leerPms(dias: number): Promise<Omit<EntradaPanel, "simuladas">> {
  const clave = `d${dias}`;
  if (cache && cache.clave === clave && Date.now() - cache.ts < TTL_MS) return cache.datos;

  const propiedad = await obtenerPropiedad();
  const hoy = hoyEnZona(propiedad?.zonaHoraria ?? "America/Guatemala");

  const [tipos, reservas] = await Promise.all([listarTiposHabitacion(), listarReservas()]);

  // Una consulta por noche: así se sabe noche a noche qué está libre. El
  // endpoint solo devuelve tipos libres en TODO el rango consultado, por eso no
  // sirve pedir las 14 noches de una. Van de a tandas porque el sistema corta
  // con "límite de consultas" si le llegan todas juntas.
  const disponibles = await enTandas(
    Array.from(
      { length: dias },
      (_, i) => () =>
        disponibilidadRango({ desde: sumarDias(hoy, i), hasta: sumarDias(hoy, i + 1) }),
    ),
  );

  const noches: NochePms[] = disponibles.map((tiposLibres, i) => ({
    fecha: sumarDias(hoy, i),
    tipos: tiposLibres,
  }));

  const datos = { propiedad, tipos, noches, reservas, hoy };
  // Una lectura incompleta no se cachea: así el siguiente "Actualizar" vuelve a
  // pedirla en vez de dejar huecos pegados tres minutos.
  if (noches.every((n) => n.tipos !== null)) cache = { clave, ts: Date.now(), datos };
  else cache = null;
  return datos;
}

export async function cargarPanel(dias = 14): Promise<PanelHotel> {
  const datos = await leerPms(dias);
  return construirPanel({ ...datos, simuladas: listarReservasSimuladas() });
}

export function invalidarCachePanel(): void {
  cache = null;
}
