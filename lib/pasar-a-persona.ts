// Pasarle una conversación a una persona, de verdad.
//
// "De verdad" quiere decir dos cosas a la vez, y las dos son necesarias:
//   1. Apagar el agente EN ESE CHAT. Si no, Sofía sigue contestando mientras la
//      persona también contesta, y el huésped recibe dos respuestas distintas.
//   2. Dejarlo asignado a alguien con nombre. Un chat que nadie tiene es un
//      chat que nadie mira: aparece en la bandeja general y ahí se queda.
//
// Antes solo se abría un ticket. El caso quedaba anotado y el chat seguía
// siendo del agente, así que la persona trabajaba el ticket mientras el huésped
// seguía hablando con la máquina.

import { setChatOverride } from "./ai-store";
import { upsertConversacion } from "./conv-store";

/** Quién recibe cada tipo de caso en Yali. Sale del kickoff del 24 de agosto. */
export const RESPONSABLE = {
  /** Socios del Sunsal Beach Club y quien quiera serlo. */
  membresias: "s3",
  /** Reservas, pagos, cancelaciones y todo lo demás. */
  reservas: "s2",
} as const;

export type Motivo = "socio" | "audio" | "pago" | "reclamo" | "otro";

/** A quién le toca según por qué se pasa. */
function responsable(motivo: Motivo): string {
  return motivo === "socio" ? RESPONSABLE.membresias : RESPONSABLE.reservas;
}

export interface Traspaso {
  ok: boolean;
  /** Id de quien quedó a cargo. */
  para: string;
  error?: string;
}

/**
 * Saca al agente de la conversación y se la deja a una persona.
 *
 * `telefono` es el número del huésped, que es como se identifica el chat.
 *
 * Si algo falla se devuelve el error en vez de tragárselo: quien llama tiene
 * que poder decidir si le avisa al huésped que alguien le va a escribir. Decirle
 * que sí cuando el traspaso no ocurrió es peor que no decirle nada.
 */
export async function pasarAPersona(
  telefono: string,
  motivo: Motivo,
  departamento?: string,
): Promise<Traspaso> {
  const para = responsable(motivo);
  if (!telefono) return { ok: false, para, error: "sin teléfono" };

  try {
    // El orden importa: primero se apaga el agente. Si se asignara primero y
    // fallara el apagado, quedarían los dos contestando, que es justo lo que
    // esto viene a evitar.
    await setChatOverride(telefono, false);
    await upsertConversacion({
      wa_from: telefono,
      asignado_a: para,
      estado: "en_progreso",
      departamento,
    });
    return { ok: true, para };
  } catch (e) {
    console.error("[pasar-a-persona]", motivo, e);
    return { ok: false, para, error: e instanceof Error ? e.message : "falló" };
  }
}
