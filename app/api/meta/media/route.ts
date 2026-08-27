// Sirve un archivo de la CDN de Meta a través nuestro.
//
// Las notas de voz de Messenger e Instagram vienen como un enlace a
// lookaside.fbsbx.com. El <audio> del navegador no las reproducía: la CDN las
// entrega sin un tipo que el navegador acepte y sin rangos. Pasarlas por acá
// arregla las dos cosas (tipo correcto, Accept-Ranges) y de paso las deja
// detrás de la sesión del panel. Solo se aceptan hosts de Meta.

import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOSTS = [/(^|\.)fbsbx\.com$/, /(^|\.)fbcdn\.net$/, /(^|\.)cdninstagram\.com$/, /(^|\.)facebook\.com$/];
const ESPERA_MS = 25_000;

function tipoDe(cabecera: string | null, url: URL): string {
  const t = (cabecera ?? "").split(";")[0].trim().toLowerCase();
  if (t && t !== "application/octet-stream" && t !== "binary/octet-stream") return t;
  // Sin tipo útil: se deduce del enlace. Las notas de voz de Instagram y
  // Messenger son AAC en contenedor MP4.
  const ruta = (url.pathname + url.search).toLowerCase();
  if (/\.(mp3)(\?|$)/.test(ruta)) return "audio/mpeg";
  if (/\.(ogg|oga|opus)(\?|$)/.test(ruta)) return "audio/ogg";
  if (/\.(jpe?g)(\?|$)/.test(ruta)) return "image/jpeg";
  if (/\.(png)(\?|$)/.test(ruta)) return "image/png";
  if (/\.(mp4|m4v)(\?|$)/.test(ruta) && !ruta.includes("audio")) return "video/mp4";
  return "audio/mp4";
}

export async function GET(req: Request) {
  tenantFromRequest(req); // exige sesión; sin ella el proxy no sirve nada
  const u = new URL(req.url).searchParams.get("u") ?? "";
  let destino: URL;
  try {
    destino = new URL(u);
  } catch {
    return new Response("Enlace inválido", { status: 400 });
  }
  if (destino.protocol !== "https:" || !HOSTS.some((h) => h.test(destino.hostname))) {
    return new Response("Host no permitido", { status: 400 });
  }
  const cabeceras: Record<string, string> = { "User-Agent": "Mozilla/5.0 (compatible; MiAgentIA)" };
  const rango = req.headers.get("range");
  if (rango) cabeceras.Range = rango;
  let r: Response;
  try {
    r = await fetch(destino, { headers: cabeceras, cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(ESPERA_MS) });
  } catch (e) {
    console.error("[meta-media] no se pudo bajar:", e instanceof Error ? e.message : e);
    return new Response("Meta no respondió", { status: 502 });
  }
  if (!r.ok && r.status !== 206) {
    console.error("[meta-media] Meta respondió", r.status, "para", destino.hostname);
    return new Response(`Meta respondió ${r.status}`, { status: r.status === 404 ? 404 : 502 });
  }
  const salida: Record<string, string> = {
    "Content-Type": tipoDe(r.headers.get("content-type"), destino),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
  };
  for (const h of ["content-length", "content-range"]) {
    const v = r.headers.get(h);
    if (v) salida[h] = v;
  }
  return new Response(r.body, { status: r.status, headers: salida });
}
