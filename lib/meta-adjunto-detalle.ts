// Qué era un adjunto que el webhook no supo nombrar.
//
// Cuando alguien responde a una historia que ya venció, Meta manda un mensaje
// sin texto y sin tipo de adjunto: quedaba "[adjunto]", que no dice nada. Al
// pedirle el mensaje a Meta sí viene el detalle: un `shares` con el enlace de
// la publicación/historia (y a veces su título), o el archivo con su mime.

import type { MetaConnection } from "./meta-store";

const GRAPH = "https://graph.facebook.com/v21.0";
const ESPERA_MS = 8_000;

export const MARCA_HISTORIA_VENCIDA = "[respondió a una historia que ya no está disponible]";

interface ShareGraph {
  link?: string;
  name?: string;
  description?: string;
}

/** La marca a partir de lo que devuelve Meta para el mensaje. Pura. */
export function marcaDesdeDetalle(d: {
  message?: string;
  attachments?: { data?: { mime_type?: string; name?: string }[] };
  shares?: { data?: ShareGraph[] };
}): string | null {
  if (d.message) return d.message;
  const share = d.shares?.data?.[0];
  if (share?.link) {
    // Una historia o publicación de Facebook: si la persona la contestó y ya
    // no está, es esto. El título de Meta ("X agregó una foto nueva") ayuda.
    if (/facebook\.com|fb\.com|instagram\.com/.test(share.link)) {
      const titulo = (share.name ?? "").trim();
      return titulo ? `${MARCA_HISTORIA_VENCIDA} ${titulo}` : MARCA_HISTORIA_VENCIDA;
    }
    return [`[compartió un enlace] ${(share.name ?? "").trim()}`.trim(), share.link].join("\n");
  }
  const adj = d.attachments?.data?.[0];
  if (adj) {
    const mime = adj.mime_type ?? "";
    if (mime.startsWith("image/")) return "[imagen]";
    if (mime.startsWith("video/")) return "[video]";
    if (mime.startsWith("audio/")) return "[audio]";
    return adj.name ? `[archivo] ${adj.name}` : "[archivo]";
  }
  return null;
}

/** Pide el mensaje a Meta y devuelve una marca mejor que "[adjunto]", o null. Nunca lanza. */
export async function detalleDeAdjunto(cx: MetaConnection, mid: string): Promise<string | null> {
  if (!cx.pageToken || !mid || !mid.startsWith("m_")) return null;
  try {
    const url = `${GRAPH}/${encodeURIComponent(mid)}?fields=${encodeURIComponent("message,attachments{mime_type,name},shares{link,name,description}")}&access_token=${encodeURIComponent(cx.pageToken)}`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ESPERA_MS) });
    const j = (await r.json()) as Parameters<typeof marcaDesdeDetalle>[0] & { error?: { message?: string } };
    if (j.error) return null;
    return marcaDesdeDetalle(j);
  } catch {
    return null;
  }
}
