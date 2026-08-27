// Qué se guarda en la bandeja por cada mensaje de Messenger o Instagram.
//
// Vive aparte del webhook porque son varias reglas que conviene poder probar
// sin levantar la ruta entera, y porque las dos de historias se descubrieron
// tarde: los mensajes llegaban, pero llegaban mudos.

export interface AdjuntoMeta {
  type?: string;
  payload?: { url?: string; title?: string };
}

export interface MensajeMeta {
  text?: string;
  attachments?: AdjuntoMeta[];
  reply_to?: { story?: { url?: string; id?: string }; mid?: string };
}

export const MARCA_REEL = "[compartió un reel]";
export const MARCA_PUBLICACION = "[compartió una publicación]";

// Nombres en español para lo que Meta manda en inglés. "[ig_reel]" a secas en
// la bandeja no le dice nada a quien atiende.
const ETIQUETA: Record<string, string> = {
  image: "imagen",
  video: "video",
  audio: "audio",
  file: "archivo",
  sticker: "sticker",
  location: "ubicación",
  template: "plantilla",
  fallback: "enlace",
};

/** Primera línea del título, corta: es contexto, no el post entero. */
function resumen(titulo: string | undefined): string {
  const linea = (titulo ?? "").split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return linea.length > 120 ? linea.slice(0, 117) + "..." : linea;
}

/**
 * Un reel o una publicación que la persona metió en el chat.
 *
 * Es el contexto de lo que pregunta después ("qué es el menú salvadoreño"
 * viene justo detrás del reel que lo anuncia). Se guarda la marca, el título
 * y el enlace en líneas separadas; la burbuja lo pinta como tarjeta.
 */
function compartido(marca: string, a: AdjuntoMeta): string {
  const titulo = resumen(a.payload?.title);
  const url = a.payload?.url?.trim();
  return [`${marca} ${titulo}`.trim(), url].filter(Boolean).join("\n");
}

function marcaDeAdjunto(a: AdjuntoMeta): string {
  const t = a.type ?? "";
  if (t === "ig_reel" || t === "reel") return compartido(MARCA_REEL, a);
  if (t === "ig_post" || t === "post") return compartido(MARCA_PUBLICACION, a);
  if (t === "fallback" && a.payload?.url) {
    return [`[enlace] ${resumen(a.payload.title)}`.trim(), a.payload.url].join("\n");
  }
  return `[${ETIQUETA[t] ?? (t || "adjunto")}]`;
}

function esCompartido(a: AdjuntoMeta | undefined): boolean {
  const t = a?.type ?? "";
  return t === "ig_reel" || t === "reel" || t === "ig_post" || t === "post";
}

/**
 * El texto a guardar, o null si no hay nada que guardar.
 *
 * Las marcas entre corchetes no son decoración: son lo único que le dice a
 * quien atiende de qué le están hablando. "cuánto vale?" a secas, sin saber
 * que responde a la historia de ayer, no se puede contestar.
 */
export function textoDelMensaje(msg: MensajeMeta): string | null {
  const adjunto = msg.attachments?.[0];
  const tipoAdjunto = adjunto?.type;

  // Mencionarnos en su historia no trae texto: el adjunto ES el mensaje.
  if (tipoAdjunto === "story_mention") return "[te mencionó en su historia]";

  let base: string | null;
  if (msg.text && adjunto && esCompartido(adjunto)) {
    // Texto Y reel en el mismo mensaje: se guardan los dos, el reel primero,
    // que es el contexto de lo que escribieron.
    base = `${marcaDeAdjunto(adjunto)}\n\n${msg.text}`;
  } else {
    base = msg.text ?? (adjunto ? marcaDeAdjunto(adjunto) : null);
  }

  // Contestar nuestra historia sí trae texto, y ese texto es el mensaje.
  if (msg.reply_to?.story) return `[respuesta a tu historia] ${base ?? ""}`.trim();

  return base;
}

/**
 * Lo contrario: de un texto guardado, la tarjeta de reel o publicación.
 * null si el texto no empieza con una de esas marcas.
 */
export function compartidoDeTexto(texto: string): {
  rotulo: string;
  titulo: string;
  url: string | null;
  resto: string;
} | null {
  const marcas: [string, string][] = [
    [MARCA_REEL, "Compartió un reel"],
    [MARCA_PUBLICACION, "Compartió una publicación"],
  ];
  for (const [marca, rotulo] of marcas) {
    if (!texto.startsWith(marca)) continue;
    const lineas = texto.slice(marca.length).trim().split("\n");
    const i = lineas.findIndex((l) => /^https?:\/\//.test(l.trim()));
    const url = i >= 0 ? lineas[i].trim() : null;
    const titulo = (i >= 0 ? lineas.slice(0, i) : lineas).join("\n").trim();
    const resto = i >= 0 ? lineas.slice(i + 1).join("\n").trim() : "";
    return { rotulo, titulo, url, resto };
  }
  return null;
}
