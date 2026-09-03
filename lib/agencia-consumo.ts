// Reporte de consumo de la IA por cliente, para el tablero de la agencia.
//
// Recibe las filas de `ai_uso_tokens` (ya materializadas por el store) y un
// periodo, y devuelve todo lo que la pantalla muestra: totales, comparación
// con el periodo anterior, caché, canales, serie por día u hora y el detalle
// por conversación. Es puro: sin base ni reloj propio, para poder probarlo.
//
// TODO EN HORA DE EL SALVADOR (UTC-6, sin horario de verano). "Hoy" es el día
// de El Salvador, no el de UTC: a las 8 p.m. de acá la base ya va por mañana.

import type { FilaConsumo } from "./tokens-store";

export type Periodo =
  | "hoy"
  | "ayer"
  | "semana"
  | "semana_pasada"
  | "7d"
  | "mes"
  | "mes_pasado"
  | "30d"
  | "rango";

export const PERIODOS: { clave: Periodo; etiqueta: string }[] = [
  { clave: "hoy", etiqueta: "Hoy" },
  { clave: "ayer", etiqueta: "Ayer" },
  { clave: "semana", etiqueta: "Esta semana" },
  { clave: "semana_pasada", etiqueta: "Semana pasada" },
  { clave: "7d", etiqueta: "7 días" },
  { clave: "mes", etiqueta: "Este mes" },
  { clave: "mes_pasado", etiqueta: "Mes pasado" },
  { clave: "30d", etiqueta: "30 días" },
  { clave: "rango", etiqueta: "Rango" },
];

export type Canal = "whatsapp" | "instagram" | "facebook" | "otro";

export interface Rango {
  clave: Periodo;
  etiqueta: string;
  /** ISO UTC, inclusivo. */
  desde: string;
  /** ISO UTC, exclusivo. */
  hasta: string;
  /** El tramo comparable anterior (mismo largo transcurrido). */
  anterior: { desde: string; hasta: string };
  granularidad: "hora" | "dia";
}

export interface Tokens {
  /** input + cacheEscritura + cacheLectura: todo lo que entró al modelo. */
  entrada: number;
  entradaSinCache: number;
  cacheEscritura: number;
  cacheLectura: number;
  salida: number;
  total: number;
}

export interface Totales {
  costo: number;
  /** Respuestas del agente (una por mensaje enviado). Las transcripciones no cuentan. */
  respuestas: number;
  conversaciones: number;
  respuestasPorConversacion: number;
  costoPorRespuesta: number;
  tokens: Tokens;
  transcripciones: { cantidad: number; costo: number };
  imagenes: number;
}

export interface EstadoCache {
  /** null cuando no hubo respuestas en el periodo. */
  encendida: boolean | null;
  respuestasConCache: number;
  respuestas: number;
  /** Porcentaje de la entrada que vino de caché (0-100). */
  pctEntradaDesdeCache: number;
  /** De las últimas 5 respuestas, cuántas usaron caché. */
  ultimas: { conCache: number; total: number };
  ahorro: number;
}

export interface PuntoSerie {
  clave: string;
  etiqueta: string;
  respuestas: number;
  conversaciones: number;
  costo: number;
  tokens: number;
}

export interface FilaCanal {
  canal: Canal;
  respuestas: number;
  conversaciones: number;
  costo: number;
}

export interface FilaConversacion {
  id: string;
  canal: Canal;
  respuestas: number;
  costo: number;
  tokens: number;
  primero: string;
  ultimo: string;
}

export interface ReporteConsumo {
  periodo: Rango;
  actual: Totales;
  anterior: Totales;
  cache: EstadoCache;
  canales: FilaCanal[];
  serie: PuntoSerie[];
  conversaciones: FilaConversacion[];
  modelos: { modelo: string; respuestas: number; costo: number }[];
}

const HORA = 3_600_000;
const DIA = 86_400_000;
const DESFASE_SV = 6 * HORA;
const MAX_DIAS_RANGO = 366;

// ---- Fechas en El Salvador -------------------------------------------------

/** Año, mes (0-11) y día en El Salvador del instante dado. */
function partesSV(ms: number): { y: number; m: number; d: number; h: number; dow: number } {
  const local = new Date(ms - DESFASE_SV);
  return {
    y: local.getUTCFullYear(),
    m: local.getUTCMonth(),
    d: local.getUTCDate(),
    h: local.getUTCHours(),
    dow: local.getUTCDay(),
  };
}

/** Medianoche de El Salvador de esa fecha, en ms UTC. */
function medianocheSV(y: number, m: number, d: number): number {
  return Date.UTC(y, m, d) + DESFASE_SV;
}

function inicioDelDia(ms: number): number {
  const p = partesSV(ms);
  return medianocheSV(p.y, p.m, p.d);
}

/** Lunes de la semana (la semana empieza en lunes). */
function inicioDeSemana(ms: number): number {
  const p = partesSV(ms);
  const desdeLunes = (p.dow + 6) % 7;
  return medianocheSV(p.y, p.m, p.d - desdeLunes);
}

function inicioDeMes(ms: number, corrimiento = 0): number {
  const p = partesSV(ms);
  return medianocheSV(p.y, p.m + corrimiento, 1);
}

function leerFechaLocal(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const ms = medianocheSV(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(ms) ? ms : null;
}

const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Límites del periodo en hora de El Salvador. `desde`/`hasta` (AAAA-MM-DD,
 * inclusivos) solo aplican a "rango"; si faltan o vienen mal, cae a 7 días.
 */
export function rangoDePeriodo(
  periodo: Periodo,
  ahora: Date = new Date(),
  desde?: string | null,
  hasta?: string | null,
): Rango {
  const t = ahora.getTime();
  const hoy = inicioDelDia(t);
  const etiqueta = (c: Periodo) => PERIODOS.find((p) => p.clave === c)?.etiqueta ?? c;

  let ini: number;
  let fin: number;
  let iniAnterior: number;
  let clave = periodo;

  switch (periodo) {
    case "hoy":
      ini = hoy;
      fin = hoy + DIA;
      iniAnterior = hoy - DIA;
      break;
    case "ayer":
      ini = hoy - DIA;
      fin = hoy;
      iniAnterior = hoy - 2 * DIA;
      break;
    case "semana":
      ini = inicioDeSemana(t);
      fin = ini + 7 * DIA;
      iniAnterior = ini - 7 * DIA;
      break;
    case "semana_pasada":
      fin = inicioDeSemana(t);
      ini = fin - 7 * DIA;
      iniAnterior = ini - 7 * DIA;
      break;
    case "mes":
      ini = inicioDeMes(t);
      fin = inicioDeMes(t, 1);
      iniAnterior = inicioDeMes(t, -1);
      break;
    case "mes_pasado":
      ini = inicioDeMes(t, -1);
      fin = inicioDeMes(t);
      iniAnterior = inicioDeMes(t, -2);
      break;
    case "30d":
      ini = hoy - 29 * DIA;
      fin = hoy + DIA;
      iniAnterior = ini - 30 * DIA;
      break;
    case "rango": {
      const a = leerFechaLocal(desde);
      const b = leerFechaLocal(hasta);
      if (a !== null && b !== null && b >= a && (b - a) / DIA < MAX_DIAS_RANGO) {
        ini = a;
        fin = b + DIA;
        iniAnterior = ini - (fin - ini);
        break;
      }
      clave = "7d";
      ini = hoy - 6 * DIA;
      fin = hoy + DIA;
      iniAnterior = ini - 7 * DIA;
      break;
    }
    case "7d":
    default:
      clave = "7d";
      ini = hoy - 6 * DIA;
      fin = hoy + DIA;
      iniAnterior = ini - 7 * DIA;
  }

  // Si el periodo todavía corre (esta semana, este mes), se compara contra el
  // mismo tramo transcurrido del anterior, no contra el anterior completo.
  const transcurrido = Math.max(0, Math.min(fin, t) - ini);
  const largoPeriodo = fin - ini;
  const finAnterior = iniAnterior + Math.min(transcurrido, largoPeriodo);
  const dias = largoPeriodo / DIA;

  return {
    clave,
    etiqueta: etiqueta(clave),
    desde: iso(ini),
    hasta: iso(fin),
    anterior: { desde: iso(iniAnterior), hasta: iso(finAnterior) },
    granularidad: dias <= 2 ? "hora" : "dia",
  };
}

// ---- Clasificación de filas ------------------------------------------------

export function canalDe(waFrom: string): Canal {
  if (waFrom.startsWith("instagram:")) return "instagram";
  if (waFrom.startsWith("facebook:")) return "facebook";
  if (/^\+?\d{7,}$/.test(waFrom)) return "whatsapp";
  return "otro";
}

/** Identificador presentable sin exponer el número completo. */
export function enmascarar(waFrom: string): string {
  const canal = canalDe(waFrom);
  if (canal === "whatsapp") {
    const digitos = waFrom.replace(/\D/g, "");
    return `+${digitos.slice(0, digitos.length - 8)} •••• ${digitos.slice(-4)}`;
  }
  if (canal === "instagram" || canal === "facebook") {
    const id = waFrom.slice(waFrom.indexOf(":") + 1);
    return `…${id.slice(-5)}`;
  }
  return waFrom.length > 12 ? `${waFrom.slice(0, 4)}…${waFrom.slice(-4)}` : waFrom;
}

const esRespuesta = (f: FilaConsumo) => (f.tipo ?? "respuesta") === "respuesta";
const usoCache = (f: FilaConsumo) =>
  f.uso.cache_read_input_tokens > 0 || f.uso.cache_creation_input_tokens > 0;
const tokensDe = (f: FilaConsumo) =>
  f.uso.input_tokens + f.uso.cache_creation_input_tokens + f.uso.cache_read_input_tokens + f.uso.output_tokens;

const redondear = (n: number, dec = 6) => Math.round(n * 10 ** dec) / 10 ** dec;

function totalesDe(filas: FilaConsumo[]): Totales {
  const tokens: Tokens = { entrada: 0, entradaSinCache: 0, cacheEscritura: 0, cacheLectura: 0, salida: 0, total: 0 };
  let costo = 0;
  let respuestas = 0;
  let imagenes = 0;
  const transcripciones = { cantidad: 0, costo: 0 };
  const convs = new Set<string>();

  for (const f of filas) {
    costo += f.costo.total;
    tokens.entradaSinCache += f.uso.input_tokens;
    tokens.cacheEscritura += f.uso.cache_creation_input_tokens;
    tokens.cacheLectura += f.uso.cache_read_input_tokens;
    tokens.salida += f.uso.output_tokens;
    if (esRespuesta(f)) {
      respuestas++;
      imagenes += f.imagenes;
      convs.add(f.waFrom);
    } else {
      transcripciones.cantidad++;
      transcripciones.costo += f.costo.total;
    }
  }
  tokens.entrada = tokens.entradaSinCache + tokens.cacheEscritura + tokens.cacheLectura;
  tokens.total = tokens.entrada + tokens.salida;

  return {
    costo: redondear(costo),
    respuestas,
    conversaciones: convs.size,
    respuestasPorConversacion: convs.size ? redondear(respuestas / convs.size, 2) : 0,
    costoPorRespuesta: respuestas ? redondear(costo / respuestas) : 0,
    tokens,
    transcripciones: { cantidad: transcripciones.cantidad, costo: redondear(transcripciones.costo) },
    imagenes,
  };
}

function estadoCache(filas: FilaConsumo[]): EstadoCache {
  const respuestas = filas.filter(esRespuesta).sort((a, b) => b.ts.localeCompare(a.ts));
  const conCache = respuestas.filter(usoCache);
  const ultimas = respuestas.slice(0, 5);
  let entrada = 0;
  let lectura = 0;
  let ahorro = 0;
  for (const f of respuestas) {
    entrada += f.uso.input_tokens + f.uso.cache_creation_input_tokens + f.uso.cache_read_input_tokens;
    lectura += f.uso.cache_read_input_tokens;
    // Lo leído de caché cuesta 0.1x: se ahorró 0.9x de lo que habría costado
    // como entrada normal.
    ahorro += f.costo.cacheLectura * 9;
  }
  return {
    encendida: respuestas.length ? ultimas.some(usoCache) : null,
    respuestasConCache: conCache.length,
    respuestas: respuestas.length,
    pctEntradaDesdeCache: entrada ? Math.round((lectura / entrada) * 100) : 0,
    ultimas: { conCache: ultimas.filter(usoCache).length, total: ultimas.length },
    ahorro: redondear(ahorro),
  };
}

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiquetaHora(h: number): string {
  if (h === 0) return "12 a.m.";
  if (h === 12) return "12 p.m.";
  return h < 12 ? `${h} a.m.` : `${h - 12} p.m.`;
}

function serieDe(filas: FilaConsumo[], rango: Rango, ahora: Date): PuntoSerie[] {
  const ini = Date.parse(rango.desde);
  const fin = Math.min(Date.parse(rango.hasta), inicioDelDia(ahora.getTime()) + DIA);
  const paso = rango.granularidad === "hora" ? HORA : DIA;
  const puntos = new Map<string, PuntoSerie & { convs: Set<string> }>();
  const claveDe = (ms: number) => {
    const p = partesSV(ms);
    const fecha = `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
    return rango.granularidad === "hora" ? `${fecha} ${String(p.h).padStart(2, "0")}` : fecha;
  };
  const varioDias = rango.granularidad === "hora" && fin - ini > DIA;

  for (let ms = ini; ms < fin; ms += paso) {
    const p = partesSV(ms);
    const etiqueta =
      rango.granularidad === "hora"
        ? varioDias
          ? `${DIAS_CORTOS[p.dow]} ${etiquetaHora(p.h)}`
          : etiquetaHora(p.h)
        : fin - ini > 45 * DIA
          ? `${p.d} ${MESES_CORTOS[p.m]}`
          : `${DIAS_CORTOS[p.dow]} ${p.d}`;
    puntos.set(claveDe(ms), { clave: claveDe(ms), etiqueta, respuestas: 0, conversaciones: 0, costo: 0, tokens: 0, convs: new Set() });
  }

  for (const f of filas) {
    const punto = puntos.get(claveDe(Date.parse(f.ts)));
    if (!punto) continue;
    punto.costo += f.costo.total;
    punto.tokens += tokensDe(f);
    if (esRespuesta(f)) {
      punto.respuestas++;
      punto.convs.add(f.waFrom);
    }
  }

  return [...puntos.values()].map(({ convs, ...p }) => ({ ...p, conversaciones: convs.size, costo: redondear(p.costo) }));
}

function canalesDe(filas: FilaConsumo[]): FilaCanal[] {
  const por = new Map<Canal, FilaCanal & { convs: Set<string> }>();
  for (const f of filas) {
    const canal = canalDe(f.waFrom);
    const c = por.get(canal) ?? { canal, respuestas: 0, conversaciones: 0, costo: 0, convs: new Set<string>() };
    c.costo += f.costo.total;
    if (esRespuesta(f)) {
      c.respuestas++;
      c.convs.add(f.waFrom);
    }
    por.set(canal, c);
  }
  return [...por.values()]
    .map(({ convs, ...c }) => ({ ...c, conversaciones: convs.size, costo: redondear(c.costo) }))
    .sort((a, b) => b.respuestas - a.respuestas || b.costo - a.costo);
}

function conversacionesDe(filas: FilaConsumo[]): FilaConversacion[] {
  const por = new Map<string, FilaConversacion>();
  for (const f of filas) {
    const c = por.get(f.waFrom) ?? {
      id: enmascarar(f.waFrom),
      canal: canalDe(f.waFrom),
      respuestas: 0,
      costo: 0,
      tokens: 0,
      primero: f.ts,
      ultimo: f.ts,
    };
    c.costo += f.costo.total;
    c.tokens += tokensDe(f);
    if (esRespuesta(f)) c.respuestas++;
    if (f.ts < c.primero) c.primero = f.ts;
    if (f.ts > c.ultimo) c.ultimo = f.ts;
    por.set(f.waFrom, c);
  }
  return [...por.values()]
    .map((c) => ({ ...c, costo: redondear(c.costo) }))
    .sort((a, b) => b.ultimo.localeCompare(a.ultimo));
}

function modelosDe(filas: FilaConsumo[]): ReporteConsumo["modelos"] {
  const por = new Map<string, { modelo: string; respuestas: number; costo: number }>();
  for (const f of filas) {
    const m = por.get(f.modelo) ?? { modelo: f.modelo, respuestas: 0, costo: 0 };
    m.costo += f.costo.total;
    if (esRespuesta(f)) m.respuestas++;
    por.set(f.modelo, m);
  }
  return [...por.values()].map((m) => ({ ...m, costo: redondear(m.costo) })).sort((a, b) => b.costo - a.costo);
}

const dentro = (f: FilaConsumo, desde: string, hasta: string) => f.ts >= desde && f.ts < hasta;

/** Arma el reporte del periodo a partir de todas las filas del cliente. */
export function reporteConsumo(filas: FilaConsumo[], rango: Rango, ahora: Date = new Date()): ReporteConsumo {
  const actuales = filas.filter((f) => dentro(f, rango.desde, rango.hasta));
  const anteriores = filas.filter((f) => dentro(f, rango.anterior.desde, rango.anterior.hasta));
  return {
    periodo: rango,
    actual: totalesDe(actuales),
    anterior: totalesDe(anteriores),
    cache: estadoCache(actuales),
    canales: canalesDe(actuales),
    serie: serieDe(actuales, rango, ahora),
    conversaciones: conversacionesDe(actuales),
    modelos: modelosDe(actuales),
  };
}

export function esPeriodo(s: string | null | undefined): s is Periodo {
  return PERIODOS.some((p) => p.clave === s);
}
