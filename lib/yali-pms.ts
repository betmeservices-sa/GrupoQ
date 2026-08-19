// Motor de ocupación y tarifas de Yali Hospitality (las tres sedes).
//
// ── POR QUÉ ESTE ARCHIVO EXISTE ──
// El grupo trabaja con Cloudbeds, pero todavía no entregó credenciales. En vez
// de dejar el dashboard vacío (o peor, con números que cambian en cada carga y
// parecen rotos), aquí se arma un libro de reservas DETERMINISTA: la misma
// fecha siempre produce la misma ocupación, las mismas llegadas y el mismo
// ingreso. Se puede grabar el demo dos veces y sale igual.
//
// Todo lo que sale de acá va marcado como demostración en el panel y en el
// agente. Cuando lleguen las llaves del PMS, el reemplazo es un solo punto:
// `cargarLibro` pasa a leer Cloudbeds (lib/cloudbeds.ts ya tiene el cliente de
// solo lectura) y el resto del archivo, que es puro, no se toca.
//
// Las funciones de cálculo son PURAS a propósito: reciben el libro y devuelven
// el panel, así se prueban sin red y sin reloj.

import { noches, sumarDias, hoyEnZona } from "./cloudbeds";
import {
  MONEDA_YALI,
  SEDES_YALI,
  hayTarifasSinConfirmar,
  unidadesDeSede,
  type HabitacionYali,
  type SedeYali,
} from "./tenants/yali-inventario";
import { listarReservasYali, type ReservaYaliDemo } from "./yali-reservas";

export const ZONA_YALI = "America/El_Salvador";

/** Hoy en la zona del hotel (El Salvador, UTC-6 todo el año). */
export function hoyYali(): string {
  return hoyEnZona(ZONA_YALI);
}

// ─────────────────────────── ruido determinista ───────────────────────────
// FNV-1a con paso final de mezcla. Barato, estable entre corridas y entre
// servidor y navegador. No es criptografía y no pretende serlo.
//
// El finalizador NO es adorno: sin él, dos llaves que solo cambian el prefijo
// ("ocupa|X" y "canal|X") quedan correlacionadas, y como el prefijo "ocupa"
// decide qué reservas existen, el reparto por canal salía torcido (WhatsApp
// aparecía con la mitad del peso que se le declaró). Con la mezcla, cada
// prefijo se comporta como un sorteo independiente.
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Número estable en [0,1) para una llave dada. */
export function ruido(llave: string): number {
  return hash32(llave) / 0x100000000;
}

function diaSemana(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

// Qué tan llena está la playa según el día. Viernes y sábado son los días
// fuertes de un hotel de playa salvadoreño; entre semana baja.
const PESO_DIA = [0.5, 0.3, 0.28, 0.32, 0.42, 0.78, 0.88]; // dom..sáb

// ─────────────────────────── libro de reservas ───────────────────────────

export type CanalReserva = "WhatsApp" | "Directo" | "Booking" | "Expedia" | "Airbnb";

export interface ReservaYali {
  id: string;
  sedeId: string;
  sedeNombre: string;
  habitacionId: string;
  habitacionNombre: string;
  huesped: string;
  desde: string; // AAAA-MM-DD, noche de entrada
  hasta: string; // AAAA-MM-DD, día de salida (no se duerme)
  huespedes: number;
  total: number;
  canal: CanalReserva;
  // "demo" = la generó este motor; "agente" = la cerró Sofía por WhatsApp.
  origen: "demo" | "agente";
}

// Nombres de demostración. Son inventados a propósito: el hotel no nos dio su
// lista de huéspedes y no se usa ningún dato real de nadie.
//
// Van en dos listas y se combinan (nombre por apellido) porque con una sola
// lista de 17 el mismo huésped aparecía tres veces seguidas en las próximas
// llegadas y el panel se veía falso. Así hay cientos de combinaciones.
const NOMBRES_DEMO = [
  "Marcela", "Rodrigo", "Andrea", "Kevin", "Gabriela", "Diego", "Ernesto",
  "Valeria", "Mauricio", "Karla", "Josué", "Fátima", "Alejandro", "Daniela",
  "Óscar", "Emily", "Lucas", "Beatriz", "Ricardo", "Camila",
];
const APELLIDOS_DEMO = [
  "Escobar", "Alfaro", "Portillo", "Menjívar", "Rivas", "Villalta", "Guirola",
  "Cáceres", "Rosales", "Bonilla", "Interiano", "Zelaya", "Peña", "Cornejo",
  "Hernández", "Carter", "Ferreira", "Quintanilla", "Molina", "Aguilar",
];

function nombreDemo(llave: string): string {
  const n = hash32(`nombre|${llave}`) % NOMBRES_DEMO.length;
  const a = hash32(`apellido|${llave}`) % APELLIDOS_DEMO.length;
  return `${NOMBRES_DEMO[n]} ${APELLIDOS_DEMO[a]}`;
}

const CANALES: CanalReserva[] = ["WhatsApp", "Directo", "Booking", "Expedia", "Airbnb"];
// Reparto de origen de las reservas. WhatsApp pesa porque es justo lo que el
// agente atiende, y es el número que el dueño quiere ver crecer.
const PESO_CANAL = [0.34, 0.22, 0.24, 0.12, 0.08];

function canalDe(llave: string): CanalReserva {
  let r = ruido(`canal|${llave}`);
  for (let i = 0; i < CANALES.length; i++) {
    if (r < PESO_CANAL[i]) return CANALES[i];
    r -= PESO_CANAL[i];
  }
  return "Directo";
}

/**
 * Arma el libro de reservas de una sede recorriendo cada llave física noche a
 * noche. Una unidad ocupada se salta las noches que dura la estadía, así que
 * nunca hay dos reservas encima de la misma habitación.
 */
export function libroDeSede(sede: SedeYali, desde: string, dias: number): ReservaYali[] {
  const reservas: ReservaYali[] = [];
  for (const hab of sede.habitaciones) {
    for (let u = 0; u < hab.unidades; u++) {
      let i = 0;
      while (i < dias) {
        const fecha = sumarDias(desde, i);
        const llave = `${sede.id}|${hab.id}|${u}|${fecha}`;
        // Las fechas lejanas están menos vendidas: un hotel no tiene lleno el
        // mes que viene igual que este fin de semana.
        const horizonte = 1 - Math.min(0.4, i / 70);
        const prob = PESO_DIA[diaSemana(fecha)] * horizonte * (0.75 + ruido(`h|${llave}`) * 0.5);
        if (ruido(`ocupa|${llave}`) > prob) {
          i += 1;
          continue;
        }
        const largo = 1 + Math.floor(ruido(`largo|${llave}`) * 3); // 1 a 3 noches
        const salida = sumarDias(fecha, largo);
        const huespedes = Math.max(
          1,
          Math.min(hab.maxHuespedes, 1 + Math.floor(ruido(`pax|${llave}`) * hab.maxHuespedes)),
        );
        reservas.push({
          id: `YH-${hash32(llave).toString(36).toUpperCase().slice(0, 6)}`,
          sedeId: sede.id,
          sedeNombre: sede.nombre,
          habitacionId: hab.id,
          habitacionNombre: hab.nombre,
          huesped: nombreDemo(llave),
          desde: fecha,
          hasta: salida,
          huespedes,
          total: hab.tarifaDemo * largo,
          canal: canalDe(llave),
          origen: "demo",
        });
        i += largo;
      }
    }
  }
  return reservas;
}

/** Libro completo de las tres sedes, más lo que ya cerró el agente. */
export function cargarLibro(desde: string, dias: number): ReservaYali[] {
  const generadas = SEDES_YALI.flatMap((s) => libroDeSede(s, desde, dias));
  return [...generadas, ...listarReservasYali().map(deAgente)];
}

function deAgente(r: ReservaYaliDemo): ReservaYali {
  return {
    id: r.id,
    sedeId: r.sedeId,
    sedeNombre: r.sedeNombre,
    habitacionId: r.habitacionId,
    habitacionNombre: r.habitacionNombre,
    huesped: r.huesped,
    desde: r.desde,
    hasta: r.hasta,
    huespedes: r.adultos + r.ninos,
    total: r.total,
    canal: "WhatsApp",
    origen: "agente",
  };
}

// ─────────────────────────── disponibilidad ───────────────────────────

/** true si la reserva ocupa esa noche (la noche de salida ya no cuenta). */
export function cubre(r: { desde: string; hasta: string }, fecha: string): boolean {
  return r.desde <= fecha && fecha < r.hasta;
}

export interface OpcionYali {
  habitacion_id: string;
  habitacion: string;
  descripcion: string;
  hasta_huespedes: number;
  libres: number;
  noches: number;
  tarifa_por_noche: number;
  total_estadia: number;
  moneda: string;
}

/**
 * Qué se puede vender en una sede para un rango. Devuelve solo los tipos con
 * al menos una unidad libre TODAS las noches del rango y con capacidad para el
 * grupo: prometer una habitación que se cae a mitad de la estadía sería peor
 * que decir que no hay.
 */
export function disponibilidad(
  sede: SedeYali,
  libro: ReservaYali[],
  desde: string,
  hasta: string,
  huespedes: number,
): OpcionYali[] {
  const n = noches(desde, hasta);
  if (n < 1) return [];
  const fechas = Array.from({ length: n }, (_, i) => sumarDias(desde, i));
  const delaSede = libro.filter((r) => r.sedeId === sede.id);

  const opciones: OpcionYali[] = [];
  for (const hab of sede.habitaciones) {
    if (hab.maxHuespedes < huespedes) continue;
    const ocupadas = fechas.map(
      (f) => delaSede.filter((r) => r.habitacionId === hab.id && cubre(r, f)).length,
    );
    const libres = hab.unidades - Math.max(...ocupadas);
    if (libres <= 0) continue;
    opciones.push({
      habitacion_id: hab.id,
      habitacion: hab.nombre,
      descripcion: hab.descripcion,
      hasta_huespedes: hab.maxHuespedes,
      libres,
      noches: n,
      tarifa_por_noche: hab.tarifaDemo,
      total_estadia: hab.tarifaDemo * n,
      moneda: MONEDA_YALI,
    });
  }
  return opciones.sort((a, b) => a.total_estadia - b.total_estadia);
}

// ─────────────────────────── panel del dueño ───────────────────────────

export interface FilaOcupacion {
  id: string;
  nombre: string;
  unidades: number;
  tarifaNoche: number;
  ocupadasPorNoche: number[];
}

export interface RepartoCanal {
  canal: CanalReserva;
  reservas: number;
  ingreso: number;
  pct: number;
}

export interface PanelSede {
  id: string;
  nombre: string;
  ubicacion: string;
  unidades: number;
  ocupadasHoy: number;
  ocupacionHoyPct: number;
  llegadasHoy: number;
  salidasHoy: number;
  huespedesEnCasa: number;
  ingresoVentana: number;
  reservasVentana: number;
  nochesVendidas: number;
  tarifaMedia: number;
  filas: FilaOcupacion[];
  // Los mismos cortes que la vista general, pero de esta sede: es lo que se
  // mira al entrar a la pestaña de un hotel.
  porCanal: RepartoCanal[];
  llegadas: ReservaYali[];
}

export interface PanelYali {
  hoy: string;
  dias: number;
  fechas: string[];
  moneda: string;
  tarifasConfirmadas: boolean;
  sedes: PanelSede[];
  kpis: {
    unidades: number;
    ocupadasHoy: number;
    ocupacionHoyPct: number;
    llegadasHoy: number;
    salidasHoy: number;
    huespedesEnCasa: number;
    reservasVentana: number;
    reservasDelAgente: number;
    ingresoVentana: number;
    tarifaMedia: number; // ADR: ingreso entre noches vendidas
    nochesVendidas: number;
    nochesVendibles: number;
  };
  porCanal: RepartoCanal[];
  llegadas: ReservaYali[]; // próximas entradas, ordenadas por fecha
  consultado: string; // ISO 8601
}

export interface EntradaPanel {
  sedes: SedeYali[];
  libro: ReservaYali[];
  hoy: string;
  dias: number;
  ahora: string; // ISO, se inyecta para que la función siga siendo pura
}

/** Reparto por canal de un conjunto de reservas, sin los canales en cero. */
function repartoPorCanal(reservas: ReservaYali[]): RepartoCanal[] {
  return CANALES.map((canal) => {
    const dela = reservas.filter((r) => r.canal === canal);
    return {
      canal,
      reservas: dela.length,
      ingreso: dela.reduce((s, r) => s + r.total, 0),
      pct: reservas.length === 0 ? 0 : Math.round((dela.length / reservas.length) * 100),
    };
  })
    .filter((c) => c.reservas > 0)
    .sort((a, b) => b.reservas - a.reservas);
}

/** Entradas de hoy en adelante, en orden, recortadas a las primeras `tope`. */
function proximasLlegadas(reservas: ReservaYali[], hoy: string, tope: number): ReservaYali[] {
  return reservas
    .filter((r) => r.desde >= hoy)
    .sort((a, b) =>
      a.desde === b.desde ? a.sedeId.localeCompare(b.sedeId) : a.desde < b.desde ? -1 : 1,
    )
    .slice(0, tope);
}

export function construirPanelYali(e: EntradaPanel): PanelYali {
  const fechas = Array.from({ length: e.dias }, (_, i) => sumarDias(e.hoy, i));
  // Solo cuenta lo que toca la ventana: una reserva de la semana pasada no
  // infla el ingreso proyectado de los próximos días.
  const enVentana = e.libro.filter((r) => r.hasta > e.hoy && r.desde < sumarDias(e.hoy, e.dias));
  // Las salidas de hoy se cuentan APARTE: quien se va hoy entró antes y ya no
  // ocupa ninguna noche de la ventana, así que `enVentana` lo deja fuera. Si se
  // contaran ahí, recepción vería siempre cero salidas.
  const salidasHoy = e.libro.filter((r) => r.hasta === e.hoy);

  const sedes: PanelSede[] = e.sedes.map((sede) => {
    const dela = enVentana.filter((r) => r.sedeId === sede.id);
    const filas: FilaOcupacion[] = sede.habitaciones.map((hab) => ({
      id: hab.id,
      nombre: hab.nombre,
      unidades: hab.unidades,
      tarifaNoche: hab.tarifaDemo,
      ocupadasPorNoche: fechas.map(
        (f) => dela.filter((r) => r.habitacionId === hab.id && cubre(r, f)).length,
      ),
    }));
    const unidades = unidadesDeSede(sede);
    const ocupadasHoy = filas.reduce((n, f) => n + f.ocupadasPorNoche[0], 0);
    const ingreso = dela.reduce((s, r) => s + r.total, 0);
    const noches = filas.reduce((m, f) => m + f.ocupadasPorNoche.reduce((a, b) => a + b, 0), 0);
    return {
      id: sede.id,
      nombre: sede.nombre,
      ubicacion: sede.ubicacion,
      unidades,
      ocupadasHoy,
      ocupacionHoyPct: unidades === 0 ? 0 : Math.round((ocupadasHoy / unidades) * 100),
      llegadasHoy: dela.filter((r) => r.desde === e.hoy).length,
      salidasHoy: salidasHoy.filter((r) => r.sedeId === sede.id).length,
      huespedesEnCasa: dela.filter((r) => cubre(r, e.hoy)).reduce((n, r) => n + r.huespedes, 0),
      ingresoVentana: ingreso,
      reservasVentana: dela.length,
      nochesVendidas: noches,
      tarifaMedia: noches === 0 ? 0 : Math.round(ingreso / noches),
      filas,
      porCanal: repartoPorCanal(dela),
      llegadas: proximasLlegadas(dela, e.hoy, 8),
    };
  });

  const unidades = sedes.reduce((n, s) => n + s.unidades, 0);
  const ocupadasHoy = sedes.reduce((n, s) => n + s.ocupadasHoy, 0);
  const nochesVendidas = sedes.reduce(
    (n, s) => n + s.filas.reduce((m, f) => m + f.ocupadasPorNoche.reduce((a, b) => a + b, 0), 0),
    0,
  );
  const ingresoVentana = sedes.reduce((s, x) => s + x.ingresoVentana, 0);

  const porCanal = repartoPorCanal(enVentana);

  return {
    hoy: e.hoy,
    dias: e.dias,
    fechas,
    moneda: MONEDA_YALI,
    tarifasConfirmadas: !hayTarifasSinConfirmar(),
    sedes,
    kpis: {
      unidades,
      ocupadasHoy,
      ocupacionHoyPct: unidades === 0 ? 0 : Math.round((ocupadasHoy / unidades) * 100),
      llegadasHoy: sedes.reduce((n, s) => n + s.llegadasHoy, 0),
      salidasHoy: sedes.reduce((n, s) => n + s.salidasHoy, 0),
      huespedesEnCasa: enVentana
        .filter((r) => cubre(r, e.hoy))
        .reduce((n, r) => n + r.huespedes, 0),
      reservasVentana: enVentana.length,
      reservasDelAgente: enVentana.filter((r) => r.origen === "agente" || r.canal === "WhatsApp")
        .length,
      ingresoVentana,
      // ADR sobre noches REALMENTE vendidas. Dividir entre las vendibles daría
      // un número más bonito y falso.
      tarifaMedia: nochesVendidas === 0 ? 0 : Math.round(ingresoVentana / nochesVendidas),
      nochesVendidas,
      nochesVendibles: unidades * e.dias,
    },
    porCanal,
    llegadas: proximasLlegadas(enVentana, e.hoy, 12),
    consultado: e.ahora,
  };
}

/** El panel que consume el dashboard. Aquí se toca el reloj; arriba no. */
export function cargarPanelYali(dias = 14): PanelYali {
  const hoy = hoyYali();
  // El libro arranca tres días antes de hoy: así las salidas de hoy existen
  // (entraron ayer o anteayer) en vez de aparecer todas en cero.
  const desde = sumarDias(hoy, -3);
  return construirPanelYali({
    sedes: SEDES_YALI,
    libro: cargarLibro(desde, dias + 3),
    hoy,
    dias,
    ahora: new Date().toISOString(),
  });
}
