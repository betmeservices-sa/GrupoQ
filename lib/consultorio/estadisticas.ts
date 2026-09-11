// Los números que mira el jefe de laboratorio.
//
// Mezcla dos cosas a propósito:
//
//   - Lo de HOY sale de la fila de verdad (consultorio_turnos): a quién se
//     atendió, cuánto esperó y cuánto duró en el mostrador. Si alguien escanea
//     el QR mientras se enseña el demo, estos números se mueven.
//   - El histórico (días anteriores, ranking de exámenes, comparativo entre
//     sucursales) es INVENTADO, porque el laboratorio no existe y no hay meses
//     de operación que mostrar. Se genera con un dado sembrado en la fecha, así
//     que es estable: al recargar sale lo mismo, y cambia de un día a otro como
//     cambiaría de verdad.
//
// Que sea inventado no lo vuelve arbitrario: los volúmenes, los picos de las
// 7 a las 9 de la mañana y la mezcla de exámenes están puestos como se comporta
// un laboratorio chico de San Salvador. Un demo con números imposibles se cae
// solo en la primera pregunta del cliente.

import { EXAMENES } from "./examenes";
import type { Turno } from "./tipos";

// Precios de lista, en dólares. Son los del guion del agente para los comunes y
// un estimado por área para el resto: alcanzan para que el jefe vea de qué
// tamaño es el día, que es lo que mira.
const PRECIOS: Record<string, number> = {
  hemograma: 12,
  hb_hto: 8,
  plaquetas: 8,
  ves: 6,
  tp_inr: 10,
  tpt: 10,
  tipeo: 8,
  glucosa: 6,
  hba1c: 22,
  creatinina: 7,
  bun: 7,
  acido_urico: 7,
  perfil_lipidico: 18,
  tgo: 8,
  tgp: 8,
  fosfatasa: 9,
  bilirrubinas: 9,
  amilasa: 12,
  electrolitos: 15,
  calcio: 8,
  proteinas: 9,
  ego: 7,
  urocultivo: 18,
  egh: 7,
  sangre_oculta: 9,
  coprocultivo: 18,
  tsh: 16,
  t4l: 16,
  t3: 16,
  prolactina: 20,
  testosterona: 24,
  estradiol: 24,
  fsh_lh: 28,
  psa: 26,
  bhcg: 20,
  insulina: 22,
  vit_d: 38,
  vit_b12: 28,
  ferritina: 22,
  vih: 18,
  vdrl: 10,
  hbsag: 18,
  hep_c: 22,
  dengue: 25,
  pcr: 12,
  factor_reumatoideo: 12,
  aso: 12,
  h_pylori: 22,
  rx_torax: 25,
  us_abdominal: 40,
  us_pelvico: 40,
  us_tiroides: 40,
  mamografia: 55,
  ekg: 20,
  densitometria: 60,
};

const PRECIO_POR_DEFECTO = 12;

export function precioDe(examen: string): number {
  return PRECIOS[examen] ?? PRECIO_POR_DEFECTO;
}

export interface Resumen {
  atendidos: number;
  examenes: number;
  /** Segundos que esperó en promedio quien llegó. */
  espera: number;
  /** Segundos que duró en promedio cada persona en el mostrador. */
  atencion: number;
  ingresos: number;
  /** Cuántos se fueron con exámenes sin hacerse. */
  sinCompletar: number;
  /** Cuántos esperaron más de diez minutos. */
  tarde: number;
}

export interface Barra {
  etiqueta: string;
  valor: number;
  /** Segunda línea, cuando el número solo no dice nada (ej. "$1,240"). */
  pie?: string;
}

export interface Estadisticas {
  hoy: Resumen;
  semana: Resumen;
  mes: Resumen;
  /** Cuánta gente llegó en cada hora de hoy. El pico es de 7 a 9. */
  porHora: Barra[];
  /** Los últimos catorce días, para ver la forma de la semana. */
  porDia: Barra[];
  topExamenes: Barra[];
  porArea: Barra[];
  sucursales: { nombre: string; atendidos: number; espera: number; ingresos: number }[];
}

/** Dado sembrado: la misma semilla da la misma serie, siempre. */
function dado(semilla: number) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const entre = (r: () => number, min: number, max: number) => Math.round(min + r() * (max - min));

const DIA = 86_400_000;

/** El día de El Salvador como número, para sembrar el dado. */
function diaSv(fecha: Date): number {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/El_Salvador",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha);
  return Number(iso.replace(/-/g, ""));
}

const HORAS = ["6 a. m.", "7", "8", "9", "10", "11", "12 m.", "1 p. m.", "2", "3", "4"];
// La forma del día en un laboratorio: se llena apenas abre, porque la gente
// llega en ayunas antes de irse a trabajar, y a media mañana se vacía.
const FORMA_HORA = [0.55, 1, 0.95, 0.7, 0.45, 0.3, 0.2, 0.25, 0.3, 0.22, 0.15];

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Lo que se cobró por una lista de exámenes. */
export function valorDe(examenes: string[]): number {
  return examenes.reduce((n, e) => n + precioDe(e), 0);
}

const promedio = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

/**
 * Lo de hoy, contado de la fila real.
 *
 * La espera se mide desde que la persona tomó turno hasta que le abrieron el
 * récord; la atención, lo que estuvo en el mostrador. A quien todavía está
 * esperando no se le cuenta la espera: su reloj sigue corriendo y meterlo
 * bajaría el promedio justo cuando la sala está llena.
 */
export function resumenDeHoy(turnos: Turno[]): Resumen {
  const cerrados = turnos.filter((t) => t.estado === "atendido" || t.estado === "pendiente");
  const esperas = cerrados
    .filter((t) => t.cerrado)
    .map((t) => Math.max(0, (Date.parse(t.cerrado!) - t.segundos * 1000 - Date.parse(t.creado)) / 1000));
  const hechos = cerrados.flatMap((t) => t.hechos);
  return {
    atendidos: cerrados.length,
    examenes: hechos.length,
    espera: promedio(esperas),
    atencion: promedio(cerrados.map((t) => t.segundos)),
    // Lo facturado de verdad: lo que recepcion cobro. El precio de catalogo
    // solo se usa cuando todavia no hay monto escrito.
    ingresos: Math.round(cerrados.reduce((n, t) => n + (t.monto ?? valorDe(t.hechos)), 0)),
    sinCompletar: cerrados.filter((t) => t.hechos.length < t.examenes.length).length,
    tarde: esperas.filter((s) => s >= 600).length,
  };
}

/** Un día inventado, con el tamaño que le toca según el día de la semana. */
function diaInventado(fecha: Date): Resumen {
  const r = dado(diaSv(fecha));
  const dia = fecha.getDay();
  // Domingo cerrado; sábado a media máquina; el lunes siempre es el más pesado.
  const factor = dia === 0 ? 0 : dia === 6 ? 0.45 : dia === 1 ? 1.2 : 1;
  const atendidos = Math.round(entre(r, 34, 52) * factor);
  const examenes = Math.round(atendidos * (2.4 + r() * 1.4));
  return {
    atendidos,
    examenes,
    espera: entre(r, 240, 780),
    atencion: entre(r, 200, 420),
    ingresos: Math.round(examenes * (11 + r() * 6)),
    sinCompletar: Math.round(atendidos * (0.04 + r() * 0.07)),
    tarde: Math.round(atendidos * (0.08 + r() * 0.14)),
  };
}

function sumar(dias: Resumen[], hoy: Resumen): Resumen {
  const todos = [...dias, hoy];
  const conGente = todos.filter((d) => d.atendidos > 0);
  return {
    atendidos: todos.reduce((n, d) => n + d.atendidos, 0),
    examenes: todos.reduce((n, d) => n + d.examenes, 0),
    espera: promedio(conGente.map((d) => d.espera)),
    atencion: promedio(conGente.map((d) => d.atencion)),
    ingresos: todos.reduce((n, d) => n + d.ingresos, 0),
    sinCompletar: todos.reduce((n, d) => n + d.sinCompletar, 0),
    tarde: todos.reduce((n, d) => n + d.tarde, 0),
  };
}

/**
 * El tablero completo.
 *
 * Recibe la fila real de hoy y arma el resto alrededor: los días anteriores son
 * inventados, y lo de hoy es lo que de verdad pasó más lo que ya se sabía de la
 * mañana (el demo casi nunca tiene una jornada entera adentro).
 */
export function estadisticas(turnosDeHoy: Turno[], sucursalNombre: string): Estadisticas {
  const ahora = new Date();
  const r = dado(diaSv(ahora) + 7);

  const real = resumenDeHoy(turnosDeHoy);
  const arranque = diaInventado(ahora);
  // Lo de hoy: lo que ya venía de la mañana más lo que pasó en pantalla.
  const hoy: Resumen = {
    atendidos: arranque.atendidos + real.atendidos,
    examenes: arranque.examenes + real.examenes,
    espera: real.atendidos > 0 ? Math.round((arranque.espera + real.espera) / 2) : arranque.espera,
    atencion: real.atendidos > 0 ? Math.round((arranque.atencion + real.atencion) / 2) : arranque.atencion,
    ingresos: arranque.ingresos + real.ingresos,
    sinCompletar: arranque.sinCompletar + real.sinCompletar,
    tarde: arranque.tarde + real.tarde,
  };

  const anteriores = (n: number) =>
    Array.from({ length: n }, (_, i) => diaInventado(new Date(ahora.getTime() - (i + 1) * DIA)));

  const semana = sumar(anteriores(6), hoy);
  const mes = sumar(anteriores(29), hoy);

  const porHora: Barra[] = HORAS.map((h, i) => ({
    etiqueta: h,
    valor: Math.max(0, Math.round(hoy.atendidos * FORMA_HORA[i] * 0.22 + entre(r, -2, 2))),
  }));

  const porDia: Barra[] = Array.from({ length: 14 }, (_, i) => {
    const f = new Date(ahora.getTime() - (13 - i) * DIA);
    const d = i === 13 ? hoy : diaInventado(f);
    return { etiqueta: DIAS_CORTOS[f.getDay()], valor: d.atendidos, pie: `$${d.ingresos}` };
  });

  // El ranking sale de lo que de verdad piden en un laboratorio: hemograma,
  // glucosa y orina se llevan la mitad del volumen.
  const TOP = [
    "hemograma",
    "glucosa",
    "ego",
    "perfil_lipidico",
    "creatinina",
    "hba1c",
    "tsh",
    "acido_urico",
  ];
  const pedidosHoy = new Map<string, number>();
  for (const t of turnosDeHoy) for (const e of t.examenes) pedidosHoy.set(e, (pedidosHoy.get(e) ?? 0) + 1);

  const topExamenes: Barra[] = TOP.map((id, i) => {
    const base = Math.round(mes.examenes * (0.14 - i * 0.013) * (0.85 + r() * 0.3));
    const valor = base + (pedidosHoy.get(id) ?? 0);
    return {
      etiqueta: EXAMENES[id]?.nombre ?? id,
      valor,
      pie: `$${(valor * precioDe(id)).toLocaleString("en-US")}`,
    };
  }).sort((a, b) => b.valor - a.valor);

  const AREAS_LAB = [
    ["Hematología", 0.31],
    ["Química sanguínea", 0.28],
    ["Orina y heces", 0.16],
    ["Hormonas y vitaminas", 0.12],
    ["Serología e infecciosas", 0.08],
    ["Imágenes y gabinete", 0.05],
  ] as const;
  const porArea: Barra[] = AREAS_LAB.map(([nombre, peso]) => ({
    etiqueta: nombre,
    valor: Math.round(mes.examenes * peso * (0.92 + r() * 0.16)),
  }));

  // La otra sucursal, para que el jefe compare. La que se está mirando lleva
  // los números de arriba; la otra se inventa alrededor.
  const otra = {
    atendidos: Math.round(mes.atendidos * (0.55 + r() * 0.2)),
    espera: entre(r, 300, 700),
    ingresos: Math.round(mes.ingresos * (0.5 + r() * 0.25)),
  };
  const sucursales = [
    { nombre: sucursalNombre, atendidos: mes.atendidos, espera: mes.espera, ingresos: mes.ingresos },
    { nombre: sucursalNombre.includes("Escalón") ? "Laboratorio Santa Tecla" : "Laboratorio Escalón", ...otra },
  ];

  return { hoy, semana, mes, porHora, porDia, topExamenes, porArea, sucursales };
}
