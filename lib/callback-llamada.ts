// "Llámeme en dos minutos": la llamada de vuelta.
//
// Cuando alguien está manejando o entrando a una reunión, lo que sigue no es
// insistir: es colgar y volver a marcar cuando dijo. Eso lo pide el agente por
// una herramienta y lo agenda VAPI (schedulePlan), no un cron nuestro, así que
// no hay nada que quede esperando en un servidor.
//
// Lo puro vive acá para poder probarlo sin marcarle a nadie: cuántos minutos
// pidió, a qué hora toca y qué se le contesta al agente.

export const NOMBRE_TOOL = "programar_callback";

/** Nadie agenda por teléfono más allá de esto; arriba es que se entendió mal. */
export const MINUTOS_MAX = 240;
const MINUTOS_MIN = 1;
/** "En un ratito", cuando el agente no manda número. */
export const MINUTOS_DEFECTO = 5;

/**
 * Los minutos que pidió. Llegan del modelo, así que pueden venir como número,
 * como texto ("15"), o no venir. Nunca tira: una llamada no se cae porque el
 * argumento vino raro.
 */
export function minutosPedidos(v: unknown): number {
  const n =
    typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".").trim()) : NaN;
  if (!Number.isFinite(n) || n <= 0) return MINUTOS_DEFECTO;
  return Math.min(MINUTOS_MAX, Math.max(MINUTOS_MIN, Math.round(n)));
}

/** La hora de la llamada de vuelta, en ISO, que es lo que entiende Vapi. */
export function cuandoLlamar(minutos: number, ahora: number = Date.now()): string {
  return new Date(ahora + minutos * 60_000).toISOString();
}

/** Lo que se le devuelve al agente para que lo diga con sus palabras. */
export function confirmacion(minutos: number): string {
  if (minutos === 1) return "Listo, queda agendada la llamada de vuelta en un minuto.";
  if (minutos < 60) return `Listo, queda agendada la llamada de vuelta en ${minutos} minutos.`;
  const horas = Math.round((minutos / 60) * 10) / 10;
  return `Listo, queda agendada la llamada de vuelta en ${horas === 1 ? "una hora" : `${horas} horas`}.`;
}

export interface ToolCallVapi {
  id: string;
  args: Record<string, unknown>;
}

interface MensajeVapi {
  type?: string;
  toolCalls?: { id?: string; function?: { name?: string; arguments?: unknown } }[];
  toolCallList?: { id?: string; name?: string; function?: { name?: string; arguments?: unknown } }[];
}

/** Los argumentos llegan como objeto o como JSON en texto, según el modelo. */
function argumentos(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return p && typeof p === "object" ? (p as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * La llamada a ESTA herramienta dentro del mensaje de Vapi, o null.
 *
 * Se busca por nombre y no se agarra la primera: un agente puede tener varias
 * herramientas y en un mismo turno el modelo puede llamar a más de una.
 */
export function buscarToolCall(msg: unknown, nombre: string = NOMBRE_TOOL): ToolCallVapi | null {
  const m = (msg ?? {}) as MensajeVapi;
  if (m.type && m.type !== "tool-calls") return null;
  const lista = [...(m.toolCalls ?? []), ...(m.toolCallList ?? [])];
  for (const t of lista) {
    const n = t.function?.name ?? (t as { name?: string }).name;
    if (n !== nombre) continue;
    return { id: t.id ?? "", args: argumentos(t.function?.arguments) };
  }
  return null;
}
