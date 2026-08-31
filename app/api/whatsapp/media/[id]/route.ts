import { abrirMediaWa } from "@/lib/wa-media";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxy de archivos de WhatsApp. El archivo en Meta solo se baja con el token,
// que nunca debe ir al cliente: el navegador pide /api/whatsapp/media/<media_id>,
// el servidor resuelve la URL temporal, descarga los bytes y los reenvía.
// Los dos pasos contra Graph viven en lib/wa-media (los comparte con el agente
// de IA, que necesita la misma imagen en base64).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rango = req.headers.get("range");
  const r = await abrirMediaWa(id, rango, tenantFromRequest(req));
  if (!r.ok) return new Response(r.error, { status: r.status });

  // Imagen/audio/video se sirven inline (para verse/reproducir en el chat); todo
  // lo demas (documentos, SVG) se fuerza a descarga, para no renderizar HTML
  // potencialmente malicioso desde nuestro origen.
  const inline = /^(image|audio|video)\//.test(r.mime) && r.mime !== "image/svg+xml";
  // Se reenvían el largo y el rango que devolvió Meta. Sin Content-Length el
  // navegador no sabe cuánto dura la nota de voz (la barra queda clavada y el
  // tiempo sale como "Infinity"), y sin Accept-Ranges no deja adelantarla. Era
  // justo lo que hacía sentir roto al reproductor.
  const cabeceras: Record<string, string> = {
    "Content-Type": r.mime,
    "Cache-Control": "private, max-age=300",
    "Content-Disposition": inline ? "inline" : "attachment",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };
  const largo = r.res.headers.get("content-length");
  if (largo) cabeceras["Content-Length"] = largo;
  const contentRange = r.res.headers.get("content-range");
  if (contentRange) cabeceras["Content-Range"] = contentRange;

  return new Response(r.res.body, {
    status: r.res.status === 206 ? 206 : 200,
    headers: cabeceras,
  });
}
