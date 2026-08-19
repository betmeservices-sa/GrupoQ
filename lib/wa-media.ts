// Descarga de archivos de WhatsApp desde Meta.
//
// Bajar un archivo son SIEMPRE dos pasos: el media_id se resuelve a una URL
// temporal, y esa URL también exige el token. Antes eso vivía duplicado dentro
// del proxy del navegador; ahora vive aquí, porque lo necesitan dos consumidores
// con formas distintas:
//   - el proxy /api/whatsapp/media/[id], que reenvía los bytes tal cual;
//   - el agente de IA, que necesita la imagen en base64 para mandársela a Claude.

const VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

/** Los media_id de Meta son alfanuméricos; cualquier otra cosa se rechaza. */
export const MEDIA_ID_VALIDO = /^[A-Za-z0-9_-]+$/;

/** Formatos de imagen que acepta la API de Claude. */
export const MIMES_IMAGEN_IA = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export type MimeImagenIA = (typeof MIMES_IMAGEN_IA)[number];

function esMimeSoportado(m: string): m is MimeImagenIA {
  return (MIMES_IMAGEN_IA as readonly string[]).includes(m);
}

/**
 * Tope de tamaño para mandarle una imagen al modelo. La API rechaza peticiones
 * de más de 5 MB, y la imagen viaja en base64 (que crece ~33%), así que el
 * corte va bastante antes. Una foto de WhatsApp normal pesa mucho menos.
 */
export const MAX_BYTES_IMAGEN_IA = 3 * 1024 * 1024;

export type ResultadoMedia =
  | { ok: true; res: Response; mime: string }
  | { ok: false; error: string; status: number };

/**
 * Resuelve el media_id y devuelve la respuesta con los bytes, sin consumirla.
 *
 * `rango` es la cabecera Range que mandó el navegador, si vino. Se reenvía tal
 * cual al CDN de Meta y su respuesta (206 + Content-Range) se devuelve entera.
 * Sin esto, un `<audio>` no puede adelantar ni retroceder la nota de voz: el
 * reproductor solo sabe seguir de largo.
 */
export async function abrirMediaWa(id: string, rango?: string | null): Promise<ResultadoMedia> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return { ok: false, error: "Faltan credenciales de WhatsApp", status: 500 };
  if (!id) return { ok: false, error: "Falta el id del archivo", status: 400 };
  if (!MEDIA_ID_VALIDO.test(id)) return { ok: false, error: "Id invalido", status: 400 };

  // 1. media_id -> URL temporal + mime.
  const metaRes = await fetch(`https://graph.facebook.com/${VERSION}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) return { ok: false, error: "No se pudo resolver el archivo", status: 502 };
  const meta = (await metaRes.json().catch(() => ({}))) as { url?: string; mime_type?: string };
  if (!meta.url) return { ok: false, error: "Meta no devolvio URL del archivo", status: 502 };

  // 2. Bajar los bytes (la URL de Meta también pide el token).
  const fileRes = await fetch(meta.url, {
    headers: {
      Authorization: `Bearer ${token}`,
      ...(rango ? { Range: rango } : {}),
    },
  });
  // 206 es un ok: es la respuesta parcial de un Range. `res.ok` solo cubre 2xx,
  // así que 206 entra, pero se deja explícito para que nadie lo "arregle".
  if ((!fileRes.ok && fileRes.status !== 206) || !fileRes.body) {
    return { ok: false, error: "No se pudo descargar el archivo", status: 502 };
  }
  return { ok: true, res: fileRes, mime: meta.mime_type || "application/octet-stream" };
}

export interface ImagenParaIA {
  base64: string;
  mime: MimeImagenIA;
  bytes: number;
}

/**
 * Baja una imagen y la deja lista para el bloque `image` de la API de Claude.
 * Devuelve null (y lo deja en el log) si el formato no sirve, si pesa de más o
 * si Meta no la entregó: el agente sigue respondiendo, solo que sin verla.
 */
export async function descargarImagenParaIA(id: string): Promise<ImagenParaIA | null> {
  try {
    const r = await abrirMediaWa(id);
    if (!r.ok) {
      console.error("IA imagen:", r.error);
      return null;
    }
    const mime = r.mime.split(";")[0].trim().toLowerCase();
    if (!esMimeSoportado(mime)) {
      console.error("IA imagen: formato no soportado", mime);
      return null;
    }
    const buf = Buffer.from(await r.res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES_IMAGEN_IA) {
      console.error("IA imagen: pesa demasiado", buf.byteLength);
      return null;
    }
    return { base64: buf.toString("base64"), mime, bytes: buf.byteLength };
  } catch (e) {
    console.error("IA imagen: fallo la descarga", e);
    return null;
  }
}
