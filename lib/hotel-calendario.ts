// Calendario mensual de disponibilidad del hotel. SOLO SERVIDOR.
//
// Una consulta por noche contra el sistema de reservas, en tandas, con la misma
// espera y reintento que usa el resto: el mes entero de golpe hace que corte por
// límite de consultas. Una noche que no se pudo leer NO se cuenta como libre;
// queda marcada como no leída y se ve distinto.

import {
  disponibilidadRango,
  enTandas,
  hoyEnZona,
  listarReservas,
  listarTiposHabitacion,
  obtenerPropiedad,
  sumarDias,
  type PropiedadPms,
  type ReservaPms,
  type TipoDisponible,
  type TipoHabitacion,
} from "./cloudbeds";
import { tiposConTarifa } from "./hotel-panel";
import { listarReservasSimuladas, nochesDe, type ReservaSimulada } from "./hotel-reservas";

const ZONA_HOTEL = "America/Guatemala";

export interface TipoLibre {
  id: string;
  nombre: string;
  maxHuespedes: number;
  tarifa: number;
}

export interface TomaSimulada {
  id: string;
  tipoNombre: string;
  huesped: string;
  desde: string;
  hasta: string;
}

// Reserva del sistema del hotel que cubre esa noche. El listado del PMS no dice
// qué habitación ocupa, así que no se inventa: solo va lo que devuelve.
export interface TomaPms {
  id: string;
  huesped: string;
  desde: string;
  hasta: string;
  fuente: string;
}

export interface DiaCalendario {
  fecha: string; // AAAA-MM-DD
  dia: number;
  pasado: boolean;
  // false = el sistema no respondió esa noche. Sin dato no se afirma nada.
  leido: boolean;
  libres: TipoLibre[];
  simuladas: TomaSimulada[];
  reservas: TomaPms[];
}

export interface MesCalendario {
  anio: number;
  mes: number; // 1 a 12
  hoy: string;
  huespedes: number;
  // Cuántas habitaciones tienen tarifa cargada, para leer los conteos con
  // referencia. null = no se pudo deducir.
  reservables: number | null;
  dias: DiaCalendario[];
  propiedad: PropiedadPms | null;
  consultado: string;
}

export function diasDelMes(anio: number, mes: number): number {
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

// Día de la semana con la semana empezando en lunes (0 = lunes, 6 = domingo).
export function diaSemanaLunes(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;
}

export function fechaDe(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export interface EntradaMes {
  anio: number;
  mes: number;
  hoy: string;
  huespedes: number;
  tipos: TipoHabitacion[];
  // Una entrada por día del mes, en orden. null = noche no leída.
  noches: Array<TipoDisponible[] | null>;
  conTarifa: Set<string> | null;
  simuladas: ReservaSimulada[];
  reservasPms: ReservaPms[];
}

// Puro: arma el mes con lo ya leído, sin tocar la red.
export function construirMes(e: EntradaMes): Omit<MesCalendario, "propiedad" | "consultado"> {
  const nombreDe = new Map(e.tipos.map((t) => [t.id, t]));

  // Qué noches bloquea cada reserva del demo.
  const tomadasPorFecha = new Map<string, TomaSimulada[]>();
  for (const r of e.simuladas) {
    for (const f of nochesDe(r)) {
      const lista = tomadasPorFecha.get(f) ?? [];
      lista.push({
        id: r.id,
        tipoNombre: r.tipoNombre,
        huesped: r.huesped,
        desde: r.desde,
        hasta: r.hasta,
      });
      tomadasPorFecha.set(f, lista);
    }
  }

  const total = diasDelMes(e.anio, e.mes);
  const dias: DiaCalendario[] = [];
  for (let d = 1; d <= total; d++) {
    const fecha = fechaDe(e.anio, e.mes, d);
    const disponibles = e.noches[d - 1];
    const simuladas = tomadasPorFecha.get(fecha) ?? [];
    const nombresTomados = new Set(simuladas.map((s) => s.tipoNombre));

    const libres: TipoLibre[] = (disponibles ?? [])
      .filter((t) => t.disponibles > 0 && t.tarifa > 0)
      .map((t) => {
        const tipo = nombreDe.get(t.id);
        return {
          id: t.id,
          nombre: tipo?.nombre ?? t.id,
          maxHuespedes: tipo?.maxHuespedes ?? 0,
          tarifa: t.tarifa,
        };
      })
      // Una habitación que el demo ya tomó esa noche deja de ofrecerse libre.
      .filter((t) => !nombresTomados.has(t.nombre))
      .sort((a, b) => a.tarifa - b.tarifa);

    // Reservas del sistema que cubren esa noche. La noche de salida ya no
    // cuenta: esa habitación queda libre para el siguiente huésped.
    const reservas: TomaPms[] = e.reservasPms
      .filter((r) => r.desde <= fecha && fecha < r.hasta)
      .map((r) => ({
        id: r.id,
        huesped: r.huesped,
        desde: r.desde,
        hasta: r.hasta,
        fuente: r.fuente,
      }));

    dias.push({
      fecha,
      dia: d,
      pasado: fecha < e.hoy,
      leido: disponibles !== null,
      libres,
      simuladas,
      reservas,
    });
  }

  return {
    anio: e.anio,
    mes: e.mes,
    hoy: e.hoy,
    huespedes: e.huespedes,
    reservables: e.conTarifa ? e.conTarifa.size : null,
    dias,
  };
}

// Caché por mes: cambiar de mes y volver no debería barrer otra vez el sistema.
const TTL_MS = 3 * 60 * 1000;
const cache = new Map<string, { ts: number; noches: Array<TipoDisponible[] | null> }>();

export function invalidarCacheCalendario(): void {
  cache.clear();
}

export async function cargarMes(opts: {
  anio?: number;
  mes?: number;
  huespedes?: number;
}): Promise<MesCalendario> {
  const propiedad = await obtenerPropiedad();
  const hoy = hoyEnZona(propiedad?.zonaHoraria ?? ZONA_HOTEL);
  const [anioHoy, mesHoy] = hoy.split("-").map(Number);

  const anio = Number.isFinite(opts.anio) && opts.anio! > 2000 ? opts.anio! : anioHoy;
  const mes = Number.isFinite(opts.mes) && opts.mes! >= 1 && opts.mes! <= 12 ? opts.mes! : mesHoy;
  const huespedes = Math.min(20, Math.max(1, Number(opts.huespedes) || 1));

  const total = diasDelMes(anio, mes);
  const clave = `${anio}-${mes}-${huespedes}`;
  const guardado = cache.get(clave);

  let noches: Array<TipoDisponible[] | null>;
  if (guardado && Date.now() - guardado.ts < TTL_MS) {
    noches = guardado.noches;
  } else {
    // Los días que ya pasaron no se consultan: no se puede reservar hacia atrás
    // y serían llamadas tiradas contra el límite de consultas.
    const aConsultar: number[] = [];
    for (let d = 1; d <= total; d++) {
      if (fechaDe(anio, mes, d) >= hoy) aConsultar.push(d);
    }
    const respuestas = await enTandas(
      aConsultar.map((d) => () => {
        const desde = fechaDe(anio, mes, d);
        return disponibilidadRango({ desde, hasta: sumarDias(desde, 1), adultos: huespedes });
      }),
    );
    noches = Array.from({ length: total }, () => null);
    aConsultar.forEach((d, i) => {
      noches[d - 1] = respuestas[i];
    });
    // Solo se cachea si el mes se leyó entero: media lectura no se deja pegada.
    if (respuestas.every((r) => r !== null)) cache.set(clave, { ts: Date.now(), noches });
  }

  const [tipos, conTarifa, reservasPms] = await Promise.all([
    listarTiposHabitacion(),
    tiposConTarifa(),
    listarReservas(),
  ]);

  return {
    ...construirMes({
      anio,
      mes,
      hoy,
      huespedes,
      tipos,
      noches,
      conTarifa,
      simuladas: listarReservasSimuladas(),
      reservasPms,
    }),
    propiedad,
    consultado: new Date().toISOString(),
  };
}
