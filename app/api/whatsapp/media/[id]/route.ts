import { abrirMediaWa } from "@/lib/wa-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Proxy de archivos de WhatsApp. El archivo en Meta solo se baja con el token,
// que nunca debe ir al cliente: el navegador pide /api/whatsapp/media/<media_id>,
// el servidor resuelve la URL temporal, descarga los bytes y los reenvía.
// Los dos pasos contra Graph viven en lib/wa-media (los comparte con el agente
// de IA, que necesita la misma imagen en base64).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await abrirMediaWa(id);
  if (!r.ok) return new Response(r.error, { status: r.status });

  // Imagen/audio/video se sirven inline (para verse/reproducir en el chat); todo
  // lo demas (documentos, SVG) se fuerza a descarga, para no renderizar HTML
  // potencialmente malicioso desde nuestro origen.
  const inline = /^(image|audio|video)\//.test(r.mime) && r.mime !== "image/svg+xml";
  return new Response(r.res.body, {
    status: 200,
    headers: {
      "Content-Type": r.mime,
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": inline ? "inline" : "attachment",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
