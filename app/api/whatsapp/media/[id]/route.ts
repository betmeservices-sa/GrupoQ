export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";

// Proxy de archivos de WhatsApp. El archivo en Meta solo se baja con el token,
// que nunca debe ir al cliente: el navegador pide /api/whatsapp/media/<media_id>,
// el servidor resuelve la URL temporal, descarga los bytes y los reenvía.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return new Response("Faltan credenciales de WhatsApp", { status: 500 });
  if (!id) return new Response("Falta el id del archivo", { status: 400 });
  // Los media_id de Meta son alfanumericos; rechaza cualquier otra cosa.
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return new Response("Id invalido", { status: 400 });

  // 1. Resolver el media_id a una URL temporal + su mime.
  const metaRes = await fetch(`https://graph.facebook.com/${VERSION}/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metaRes.ok) return new Response("No se pudo resolver el archivo", { status: 502 });
  const meta = (await metaRes.json().catch(() => ({}))) as { url?: string; mime_type?: string };
  if (!meta.url) return new Response("Meta no devolvio URL del archivo", { status: 502 });

  // 2. Descargar los bytes (la URL de Meta tambien requiere el token).
  const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${token}` } });
  if (!fileRes.ok || !fileRes.body) {
    return new Response("No se pudo descargar el archivo", { status: 502 });
  }

  const mime = meta.mime_type || "application/octet-stream";
  // Imagen/audio/video se sirven inline (para verse/reproducir en el chat); todo
  // lo demas (documentos, SVG) se fuerza a descarga, para no renderizar HTML
  // potencialmente malicioso desde nuestro origen.
  const inline = /^(image|audio|video)\//.test(mime) && mime !== "image/svg+xml";
  return new Response(fileRes.body, {
    status: 200,
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": inline ? "inline" : "attachment",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
