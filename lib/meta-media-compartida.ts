// La miniatura y el video de un reel o publicación que metieron en el chat.
//
// Meta manda el adjunto con el enlace, el título y el id del video, pero sin
// imagen. Para verlo sin salir del panel hay que pedirle el medio a Meta con
// el id: si es una publicación de la cuenta (que es lo normal, la gente
// comparte lo que el hotel publicó), devuelve la portada y el mp4.
//
// Los enlaces que da Meta vencen en unas horas. Alcanza: el reel se mira
// cuando llega la pregunta, no una semana después. Cuando vence, queda la
// tarjeta con el título y "Abrir", que sigue llevando al reel.

import type { MetaConnection } from "./meta-store";
import type { AdjuntoMeta } from "./meta-texto-mensaje";

const GRAPH = "https://graph.facebook.com/v21.0";
const ESPERA_MS = 5_000;

export interface PreviewCompartido {
  miniatura?: string;
  video?: string;
}

interface AdjuntoConId extends AdjuntoMeta {
  payload?: AdjuntoMeta["payload"] & { reel_video_id?: string; id?: string };
}

function esCompartido(tipo: string | undefined): boolean {
  return tipo === "ig_reel" || tipo === "reel" || tipo === "ig_post" || tipo === "post";
}

/**
 * Portada y video del medio compartido, o nada si Meta no lo da.
 *
 * Nunca lanza: perder la miniatura es un detalle, perder el mensaje no.
 */
export async function previewDeAdjunto(
  cx: MetaConnection,
  adjunto: AdjuntoConId | undefined,
): Promise<PreviewCompartido> {
  if (!adjunto || !esCompartido(adjunto.type)) return {};
  const id = adjunto.payload?.reel_video_id ?? adjunto.payload?.id;
  if (!id || !/^\d+$/.test(id) || !cx.pageToken) return {};
  try {
    const url = `${GRAPH}/${id}?fields=media_type,thumbnail_url,media_url&access_token=${encodeURIComponent(cx.pageToken)}`;
    const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ESPERA_MS) });
    const j = (await r.json()) as {
      media_type?: string;
      thumbnail_url?: string;
      media_url?: string;
      error?: { message?: string };
    };
    if (j.error) {
      console.error("[meta-media] no se pudo pedir el medio", id, ":", j.error.message);
      return {};
    }
    const esVideo = j.media_type === "VIDEO";
    return {
      // En una foto, media_url ES la imagen; en un video, la portada es thumbnail_url.
      miniatura: j.thumbnail_url ?? (esVideo ? undefined : j.media_url),
      video: esVideo ? j.media_url : undefined,
    };
  } catch (e) {
    console.error("[meta-media] no se pudo pedir el medio", id, ":", e);
    return {};
  }
}
