// Quién cerró cada reserva, y a qué hora pasó cada cosa.
//
// LA PREGUNTA QUE CONTESTA, tal como la hizo el cliente: de las reservas
// confirmadas, "qué tanto fue Sofía y qué tanto fue Vero". Y con las horas: a
// qué hora arrancó la conversación, a qué hora se le pasó a una persona, y a
// qué hora se cerró el trato.
//
// Es la única medida honesta de qué hace el agente. "Sofía contestó 85% de los
// chats" no dice nada si al final siempre tuvo que entrar alguien a cerrar.
//
// DOS DEFINICIONES QUE HAY QUE ACERTAR O EL REPORTE MIENTE:
//
// 1. CUÁNDO EMPEZÓ LA CONVERSACIÓN. No es el primer mensaje del hilo: un
//    huésped que escribió en abril y volvió en septiembre daría "empezó hace
//    cinco meses", y el trato se hizo en dos días. Se toma el arranque de la
//    TANDA que terminó en la reserva, cortando donde hubo un silencio largo.
//
// 2. QUIÉN CERRÓ. No es quien apretó el botón de confirmar: es si una persona
//    tuvo que meterse ANTES de que se cerrara. Si Sofía habló sola hasta el
//    final, el trato es de Sofía aunque a alguien le tocara darle al botón.

/** Un silencio de más de esto corta la tanda: lo de antes es otra visita. */
export const CORTE_HORAS = 24;

export interface MensajeDelHilo {
  direction: "in" | "out";
  ts: string;
  /** "ia" es Sofía. Cualquier otro es una persona del hotel. */
  staffId?: string | null;
  staffNombre?: string | null;
}

export const ID_AGENTE = "ia";

export type Cerro = "sofia" | "persona";

export interface Cierre {
  /** Cuándo arrancó la tanda que terminó en la reserva. */
  inicio: string | null;
  /** Cuándo escribió una persona por primera vez. null = nunca entró nadie. */
  pasoAPersona: string | null;
  /** Quién fue esa persona, si hubo. */
  persona: string | null;
  /** Quién se lleva el trato. */
  cerro: Cerro;
  mensajesAgente: number;
  mensajesPersona: number;
  /** Minutos desde que arrancó hasta que se cerró. null si falta alguna punta. */
  minutosTotales: number | null;
  /** Minutos que tardó en pasar a una persona desde que arrancó. */
  minutosHastaPersona: number | null;
}

const MIN = 60_000;

function entre(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round((tb - ta) / MIN);
}

/**
 * La tanda que terminó en la reserva.
 *
 * Se camina el hilo hacia atrás desde el cierre y se corta en el primer
 * silencio largo. Lo de antes de ese silencio es otra visita, de otro mes, y
 * meterla haría que "tardó en cerrar" midiera meses que nadie estuvo esperando.
 */
export function tandaDelCierre(mensajes: MensajeDelHilo[], cierre?: string | null): MensajeDelHilo[] {
  const hilo = [...mensajes]
    .filter((m) => !Number.isNaN(Date.parse(m.ts)))
    .sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  if (hilo.length === 0) return [];

  const tope = cierre ? Date.parse(cierre) : Infinity;
  // Hasta el cierre: lo que se habló después no es parte de cómo se cerró.
  const hasta = hilo.filter((m) => Date.parse(m.ts) <= tope);
  const base = hasta.length > 0 ? hasta : hilo;

  let desde = 0;
  for (let i = base.length - 1; i > 0; i--) {
    if (Date.parse(base[i].ts) - Date.parse(base[i - 1].ts) > CORTE_HORAS * 60 * MIN) {
      desde = i;
      break;
    }
  }
  return base.slice(desde);
}

/**
 * Cómo se cerró esta reserva.
 *
 * `confirmadaTs` es cuándo quedó confirmada; se usa para cortar el hilo y para
 * medir cuánto tardó.
 */
export function comoSeCerro(mensajes: MensajeDelHilo[], confirmadaTs?: string | null): Cierre {
  const tanda = tandaDelCierre(mensajes, confirmadaTs);
  const salientes = tanda.filter((m) => m.direction === "out");
  const dePersona = salientes.filter((m) => m.staffId && m.staffId !== ID_AGENTE);
  const delAgente = salientes.filter((m) => m.staffId === ID_AGENTE);

  const primera = dePersona[0] ?? null;
  const inicio = tanda[0]?.ts ?? null;

  return {
    inicio,
    pasoAPersona: primera?.ts ?? null,
    persona: primera?.staffNombre?.trim() || null,
    // Si nadie del hotel escribió antes del cierre, el trato lo hizo Sofía,
    // aunque después alguien le diera al botón de confirmar.
    cerro: dePersona.length > 0 ? "persona" : "sofia",
    mensajesAgente: delAgente.length,
    mensajesPersona: dePersona.length,
    minutosTotales: entre(inicio, confirmadaTs),
    minutosHastaPersona: entre(inicio, primera?.ts ?? null),
  };
}

export interface ResumenCierres {
  total: number;
  /** Cuántas cerró el agente sin que nadie se metiera, y cuánto dinero. */
  sofia: { n: number; total: number };
  persona: { n: number; total: number };
  /** Quiénes cerraron, de la que más cerró a la que menos. */
  porPersona: { nombre: string; n: number; total: number }[];
  /** La mediana de lo que tarda un trato en cerrarse, en minutos. */
  medianaMinutos: number | null;
}

export interface ReservaConCierre {
  total?: number | null;
  cierre: Cierre;
}

/** El titular: cuánto de esto es del agente y cuánto de la gente. */
export function resumirCierres(reservas: readonly ReservaConCierre[]): ResumenCierres {
  const suma = (rs: readonly ReservaConCierre[]) => ({
    n: rs.length,
    total: Math.round(rs.reduce((s, r) => s + (r.total ?? 0), 0)),
  });

  const porNombre = new Map<string, ReservaConCierre[]>();
  for (const r of reservas) {
    if (r.cierre.cerro !== "persona") continue;
    const nombre = r.cierre.persona ?? "El equipo";
    porNombre.set(nombre, [...(porNombre.get(nombre) ?? []), r]);
  }

  const minutos = reservas
    .map((r) => r.cierre.minutosTotales)
    .filter((m): m is number => m !== null && m >= 0)
    .sort((a, b) => a - b);

  return {
    total: reservas.length,
    sofia: suma(reservas.filter((r) => r.cierre.cerro === "sofia")),
    persona: suma(reservas.filter((r) => r.cierre.cerro === "persona")),
    porPersona: [...porNombre.entries()]
      .map(([nombre, rs]) => ({ nombre, ...suma(rs) }))
      .sort((a, b) => b.n - a.n || b.total - a.total),
    medianaMinutos: minutos.length ? minutos[Math.floor(minutos.length / 2)] : null,
  };
}
