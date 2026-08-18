// Las dos barandas del agente de WhatsApp, en un solo lugar y sin efectos:
//
//   1. PREGUNTA DE SUCURSAL OBLIGATORIA. Si el tenant tiene sedes, el PRIMER
//      mensaje del agente es siempre "¿a cuál sucursal se comunica?". No se le
//      pide al modelo que se acuerde de preguntarlo (se le olvidaría): el texto
//      sale de aquí, sin llamar a Claude, así que cuesta 0 tokens.
//
//   2. TOPE DURO DE MENSAJES por conversación / número / lead. Al llegar al
//      tope, el agente NO se queda callado: manda un cierre y el chat pasa a
//      una persona.
//
// Todo esto son funciones puras: deciden, no ejecutan. Quien ejecuta es
// lib/ai-reply.ts. Por eso se puede probar entero sin tocar WhatsApp ni Claude.

import type { SucursalTenant, TenantSucursales } from "./tenants/types";

// ── Las dos constantes que el dueño pidió poder mover ──

/** Tope de mensajes que el agente manda en UNA conversación. Se puede subir o
 *  bajar por tenant con `ai.limiteMensajes`. */
export const LIMITE_MENSAJES_IA_DEFAULT = 10;

/**
 * DECISIÓN TOMADA: la pregunta de sucursal SÍ cuenta dentro de los 10.
 *
 * Por qué: el tope es un presupuesto de "mensajes que este número recibe de
 * nosotros". Que la pregunta quedara fuera volvería el tope efectivo 11 y haría
 * imposible auditar de un vistazo cuántos mensajes salieron. Con esto la regla
 * es exacta: el agente NUNCA manda más de `limite` mensajes por conversación,
 * incluyendo la pregunta de sucursal, sus reintentos y el cierre.
 *
 * Para cambiarlo, poner false: se descontarían del contador los mensajes
 * deterministas de sucursal.
 */
export const PREGUNTA_SUCURSAL_CUENTA = true;

/** Mensaje de cierre al agotar el tope. Explícito: nadie queda colgado. */
export const CIERRE_POR_LIMITE =
  "Para darle una mejor atención le paso con una persona del equipo, que continúa con usted por este mismo chat. Gracias por escribirnos.";

// ── Decisión del turno ──

export type DecisionTurno =
  /** Mandar la pregunta de sucursal (primer mensaje). Sin modelo, 0 tokens. */
  | { tipo: "preguntar_sucursal"; texto: string }
  /** No se entendió la sucursal: reformular. Sin modelo, 0 tokens. */
  | { tipo: "reintentar_sucursal"; texto: string }
  /** Se agotaron los reintentos: avisar y pasar a una persona. */
  | { tipo: "handoff_sucursal"; texto: string }
  /** Responder con la IA. `sucursal` es null si el tenant no maneja sedes. */
  | { tipo: "responder_ia"; sucursal: SucursalTenant | null; recienElegida: boolean }
  /** Se llegó al tope: mandar el cierre y pasar a una persona. */
  | { tipo: "cerrar_por_limite"; texto: string }
  /** Ya se cerró antes. No mandar nada (ni gastar un token). */
  | { tipo: "silencio"; motivo: "limite" };

export interface EstadoTurno {
  /** Config de sedes del tenant, o undefined si no maneja sucursales. */
  sucursales?: TenantSucursales;
  /** Tope de mensajes del tenant. Si falta, LIMITE_MENSAJES_IA_DEFAULT. */
  limite?: number;
  /** Mensajes que YA salieron de nuestro lado en esta conversación. */
  mensajesAgente: number;
  /** De esos, cuántos fueron mensajes deterministas de sucursal. */
  mensajesSucursal: number;
  /** Sucursal ya confirmada por el contacto (id), o null. */
  sucursalId: string | null;
  /** Cuántas veces se preguntó ya por la sucursal. */
  intentos: number;
  /** Último texto que escribió el contacto (con el que se intenta identificar). */
  textoCliente: string;
}

/** Mensajes que consumen presupuesto, según PREGUNTA_SUCURSAL_CUENTA. */
export function mensajesQueCuentan(e: {
  mensajesAgente: number;
  mensajesSucursal: number;
}): number {
  return PREGUNTA_SUCURSAL_CUENTA ? e.mensajesAgente : e.mensajesAgente - e.mensajesSucursal;
}

export function limiteDe(limite?: number): number {
  return limite && limite > 0 ? limite : LIMITE_MENSAJES_IA_DEFAULT;
}

/**
 * Qué hacer con este turno. El orden importa:
 *   tope agotado > cierre > sucursal > respuesta normal.
 * El cierre ocupa el ÚLTIMO cupo (el mensaje número `limite`), así el total de
 * mensajes salientes nunca pasa de `limite`.
 */
export function decidirTurno(e: EstadoTurno): DecisionTurno {
  const limite = limiteDe(e.limite);
  const usados = mensajesQueCuentan(e);

  // Ya se mandó el cierre: no se responde más.
  if (usados >= limite) return { tipo: "silencio", motivo: "limite" };

  // Queda UN cupo: se gasta en el cierre, no en otra respuesta a medias.
  if (usados === limite - 1) return { tipo: "cerrar_por_limite", texto: CIERRE_POR_LIMITE };

  // Sin sedes declaradas, el agente responde normal.
  if (!e.sucursales) return { tipo: "responder_ia", sucursal: null, recienElegida: false };

  const yaElegida = e.sucursalId
    ? (e.sucursales.opciones.find((o) => o.id === e.sucursalId) ?? null)
    : null;
  if (yaElegida) return { tipo: "responder_ia", sucursal: yaElegida, recienElegida: false };

  // Nunca se preguntó: la pregunta es el primer mensaje, pase lo que pase.
  if (e.intentos === 0) return { tipo: "preguntar_sucursal", texto: e.sucursales.pregunta };

  // Ya se preguntó: ¿la respuesta identifica una sucursal?
  const elegida = interpretarSucursal(e.textoCliente, e.sucursales);
  if (elegida) return { tipo: "responder_ia", sucursal: elegida, recienElegida: true };

  if (e.intentos <= e.sucursales.maxReintentos) {
    return { tipo: "reintentar_sucursal", texto: e.sucursales.reintento };
  }
  return { tipo: "handoff_sucursal", texto: e.sucursales.handoff };
}

// ── Identificar la sucursal en lo que escribió el contacto ──

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita los acentos (marcas combinantes)
    .replace(/[^a-z0-9s]/g, " ") // signos fuera: "a)" -> "a"
    .replace(/s+/g, " ")
    .trim();
}

/**
 * Hasta cuántas palabras se considera "una respuesta a la pregunta" y no una
 * frase suelta. Importa para los alias de UNA palabra: en español "a" es
 * preposición, así que "quiero ir a la playa" no puede leerse como "sucursal A".
 * Las respuestas de verdad ("A", "la B", "b por favor") son cortas.
 */
export const MAX_PALABRAS_RESPUESTA_CORTA = 4;

// Un alias calza si sus palabras aparecen SEGUIDAS y completas en el mensaje.
// Nada de substring crudo: "hola buenas tardes" contiene "la b" y elegiría la
// sucursal B. Y los alias de una sola palabra solo valen en mensajes cortos.
// Los dos casos los cazan pruebas en sucursal-gate.test.ts.
function coincide(palabras: string[], alias: string): boolean {
  const partes = normalizar(alias).split(" ").filter(Boolean);
  if (partes.length === 0) return false;
  if (partes.length === 1 && palabras.length > MAX_PALABRAS_RESPUESTA_CORTA) return false;
  for (let i = 0; i + partes.length <= palabras.length; i++) {
    if (partes.every((parte, j) => palabras[i + j] === parte)) return true;
  }
  return false;
}

/**
 * Devuelve la sucursal que el contacto nombró, o null si no está claro.
 * Si el texto calza con MÁS de una, devuelve null: preferimos volver a
 * preguntar antes que mandarlo a la sede equivocada.
 */
export function interpretarSucursal(
  texto: string,
  sucursales: TenantSucursales,
): SucursalTenant | null {
  const palabras = normalizar(texto ?? "").split(" ").filter(Boolean);
  if (palabras.length === 0) return null;

  const candidatas = sucursales.opciones.filter((o) => {
    const propios = [o.letra, o.nombre, ...o.alias];
    return propios.some((alias) => coincide(palabras, alias));
  });
  return candidatas.length === 1 ? candidatas[0] : null;
}

/** Línea que se le inyecta al system prompt una vez identificada la sede. */
export function contextoSucursal(s: SucursalTenant | null): string {
  if (!s) return "";
  return `\n\nSUCURSAL DEL CONTACTO: ${s.nombre}. El contacto ya la confirmó al inicio de la conversación. NO se la vuelvas a preguntar y responde SIEMPRE sobre esa sede. Si pide algo de otra sede, dile que le pasas con esa sucursal.`;
}
