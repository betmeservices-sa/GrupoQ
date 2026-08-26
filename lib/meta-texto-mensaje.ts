// Qué se guarda en la bandeja por cada mensaje de Messenger o Instagram.
//
// Vive aparte del webhook porque son varias reglas que conviene poder probar
// sin levantar la ruta entera, y porque las dos de historias se descubrieron
// tarde: los mensajes llegaban, pero llegaban mudos.

export interface MensajeMeta {
  text?: string;
  attachments?: Array<{ type?: string }>;
  reply_to?: { story?: { url?: string; id?: string }; mid?: string };
}

/**
 * El texto a guardar, o null si no hay nada que guardar.
 *
 * Las marcas entre corchetes no son decoración: son lo único que le dice a
 * quien atiende de qué le están hablando. "cuánto vale?" a secas, sin saber
 * que responde a la historia de ayer, no se puede contestar.
 */
export function textoDelMensaje(msg: MensajeMeta): string | null {
  const tipoAdjunto = msg.attachments?.[0]?.type;
  const base = msg.text ?? (msg.attachments?.length ? `[${tipoAdjunto ?? "adjunto"}]` : null);

  // Mencionarnos en su historia no trae texto: el adjunto ES el mensaje.
  if (tipoAdjunto === "story_mention") return "[te mencionó en su historia]";

  // Contestar nuestra historia sí trae texto, y ese texto es el mensaje.
  if (msg.reply_to?.story) return `[respuesta a tu historia] ${base ?? ""}`.trim();

  return base;
}
