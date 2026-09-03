// Periodos del panel (hoy, ayer, semana, mes, rango) en hora de El Salvador.
//
// Vive aparte porque lo usan dos reportes distintos: el consumo de la agencia y
// el embudo de ventas. Todo se corta a la medianoche de El Salvador (UTC-6, sin
// horario de verano), NO a la de UTC: a las 8 p.m. de acá la base ya está en el
// día siguiente, y "hoy" salía partido en dos.

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

export const HORA = 3_600_000;
export const DIA = 86_400_000;
const DESFASE_SV = 6 * HORA;
const MAX_DIAS_RANGO = 366;

export const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Año, mes (0-11), día, hora y día de la semana en El Salvador. */
export function partesSV(ms: number): { y: number; m: number; d: number; h: number; dow: number } {
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
export function medianocheSV(y: number, m: number, d: number): number {
  return Date.UTC(y, m, d) + DESFASE_SV;
}

export function inicioDelDia(ms: number): number {
  const p = partesSV(ms);
  return medianocheSV(p.y, p.m, p.d);
}

/** Lunes de la semana (la semana empieza en lunes). */
export function inicioDeSemana(ms: number): number {
  const p = partesSV(ms);
  const desdeLunes = (p.dow + 6) % 7;
  return medianocheSV(p.y, p.m, p.d - desdeLunes);
}

export function inicioDeMes(ms: number, corrimiento = 0): number {
  const p = partesSV(ms);
  return medianocheSV(p.y, p.m + corrimiento, 1);
}

/** "AAAA-MM-DD" en hora de El Salvador. */
export function claveDeDia(ms: number): string {
  const p = partesSV(ms);
  return `${p.y}-${String(p.m + 1).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

export function etiquetaHora(h: number): string {
  if (h === 0) return "12 a.m.";
  if (h === 12) return "12 p.m.";
  return h < 12 ? `${h} a.m.` : `${h - 12} p.m.`;
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

export function esPeriodo(s: string | null | undefined): s is Periodo {
  return PERIODOS.some((p) => p.clave === s);
}
