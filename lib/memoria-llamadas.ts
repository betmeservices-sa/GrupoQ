// Memoria del agente de voz entre llamadas.
//
// Hoy cada llamada arranca en cero: el agente atiende al que llamó ayer como si
// no lo conociera. Esto guarda lo que quedó de cada llamada, con el teléfono
// como llave, y se lo devuelve al agente cuando esa persona vuelve a marcar.
//
// La parte difícil no es guardarlo, es USARLO sin que suene a fichero policial.
// Por eso lo que se le entrega al agente es un párrafo corto y en lenguaje
// natural, no un volcado de campos: si le pasás una ficha, lee una ficha.

export interface MemoriaLlamada {
  tenant: string;
  /** Teléfono normalizado. Es la llave. */
  telefono: string;
  nombre?: string;
  /** Modelos por los que preguntó, del más reciente al más viejo. */
  modelos: string[];
  /** Para qué lo quiere: familia, trabajo, ciudad, primer carro. */
  uso?: string;
  /** Contado o financiamiento. */
  pago?: string;
  /** Si en alguna llamada quedó una cita. */
  agendo: boolean;
  /** Una línea de qué pasó la última vez. */
  resumen: string;
  llamadas: number;
  ultima: string;
  ultimoCallId?: string;
}

/** Lo que el agente extrae al terminar una llamada. */
export interface ExtractoLlamada {
  nombre?: string;
  modelos?: string[];
  uso?: string;
  pago?: string;
  agendo?: boolean;
  resumen?: string;
}

/**
 * Teléfono comparable.
 *
 * Vapi entrega E.164 (+50375391721) pero la misma persona puede aparecer
 * marcada de otras formas. Se compara por los últimos 8 dígitos, que en El
 * Salvador es el número completo sin código de país.
 */
export function normalizarTelefono(raw: string): string {
  const digitos = (raw || "").replace(/\D+/g, "");
  return digitos.length > 8 ? digitos.slice(-8) : digitos;
}

const LIMITE_MODELOS = 4;

/**
 * Funde lo nuevo sobre lo viejo.
 *
 * Los campos nuevos ganan, pero un campo vacío NO borra lo que ya se sabía: que
 * en esta llamada no se hable del uso no significa que haya dejado de ser para
 * la familia.
 */
export function fundir(
  previo: MemoriaLlamada | null,
  extracto: ExtractoLlamada,
  datos: { tenant: string; telefono: string; callId?: string; ahora?: string },
): MemoriaLlamada {
  const ahora = datos.ahora ?? new Date().toISOString();
  const nuevos = (extracto.modelos ?? []).map((m) => m.trim()).filter(Boolean);
  // Los recién mencionados van adelante, sin repetir, y se recorta la cola: a
  // nadie le sirve que el agente recuerde ocho modelos de hace meses.
  const modelos = [...new Set([...nuevos, ...(previo?.modelos ?? [])])].slice(0, LIMITE_MODELOS);

  return {
    tenant: datos.tenant,
    telefono: datos.telefono,
    nombre: extracto.nombre?.trim() || previo?.nombre,
    modelos,
    uso: extracto.uso?.trim() || previo?.uso,
    pago: extracto.pago?.trim() || previo?.pago,
    agendo: extracto.agendo ?? previo?.agendo ?? false,
    resumen: extracto.resumen?.trim() || previo?.resumen || "",
    llamadas: (previo?.llamadas ?? 0) + 1,
    ultima: ahora,
    ultimoCallId: datos.callId || previo?.ultimoCallId,
  };
}

function haceCuanto(iso: string, ahora = Date.now()): string {
  const dias = Math.floor((ahora - Date.parse(iso)) / 86_400_000);
  if (!Number.isFinite(dias) || dias < 0) return "hace poco";
  if (dias === 0) return "hoy mismo";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  if (dias < 14) return "hace una semana";
  if (dias < 60) return `hace ${Math.round(dias / 7)} semanas`;
  return `hace ${Math.round(dias / 30)} meses`;
}

/**
 * El párrafo que recibe el agente.
 *
 * En prosa y no en campos a propósito. Con una ficha ("uso: familia | pago:
 * financiamiento") el modelo tiende a leerla en voz alta; con una frase suelta
 * la usa como un dato que ya sabía.
 */
export function contextoParaAgente(m: MemoriaLlamada | null, ahora = Date.now()): string {
  if (!m || m.llamadas === 0) {
    return "Es la primera vez que llama este número. No hay nada previo, atendela como nueva y no menciones nada de historial.";
  }

  const partes: string[] = [];
  partes.push(
    m.llamadas === 1
      ? `Ya había llamado una vez, ${haceCuanto(m.ultima, ahora)}.`
      : `Ya llamó ${m.llamadas} veces, la última ${haceCuanto(m.ultima, ahora)}.`,
  );
  if (m.nombre) partes.push(`Se llama ${m.nombre}.`);
  if (m.modelos.length === 1) partes.push(`Andaba viendo la ${m.modelos[0]}.`);
  else if (m.modelos.length > 1)
    partes.push(`Preguntó por ${m.modelos.slice(0, 2).join(" y ")}.`);
  if (m.uso) partes.push(`La quería para ${m.uso}.`);
  if (m.pago) partes.push(`Hablaron de ${m.pago}.`);
  if (m.agendo) partes.push("Quedó una cita agendada.");
  if (m.resumen) partes.push(`De la última llamada: ${m.resumen}`);

  return (
    partes.join(" ") +
    "\n\nEsto es para que lo tengas presente, no para que lo recites. Mencioná como mucho UNA cosa, al principio, como quien se acuerda."
  );
}
