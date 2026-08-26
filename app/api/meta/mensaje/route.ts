import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { conexionesDe } from "@/lib/meta-store";
import { GRAPH } from "@/lib/meta-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Un mensaje de Messenger tal cual lo describe Meta, con todos sus campos.
//
// Existe porque el sondeo de conversaciones guarda solo texto, y cuando algo
// llega "mudo" (una respuesta a historia de Facebook cayó como mensaje suelto)
// hay que ver qué más venía en el mensaje para saber de dónde sacar el
// contexto. Se prueba con el token de cada página del cliente hasta que una
// lo reconozca: el mensaje solo se puede leer con el token de su página.

const CAMPOS =
  "id,created_time,from,to,message,sticker,tags,reply_to," +
  "attachments{id,mime_type,name,image_data,video_data,file_url}," +
  "shares{id,link,name,description}";

export async function GET(req: Request) {
  const mid = new URL(req.url).searchParams.get("mid")?.trim();
  if (!mid || !/^[\w-]+$/.test(mid)) {
    return NextResponse.json({ ok: false, error: "Falta mid." }, { status: 400 });
  }
  const tenant = tenantFromRequest(req);
  const errores: string[] = [];
  for (const cx of await conexionesDe(tenant)) {
    if (!cx.pageToken) continue;
    const r = await fetch(
      `${GRAPH}/${encodeURIComponent(mid)}?fields=${CAMPOS}&access_token=${encodeURIComponent(cx.pageToken)}`,
      { cache: "no-store" },
    );
    const j = (await r.json()) as { error?: { message?: string } } & Record<string, unknown>;
    if (!j.error) return NextResponse.json({ ok: true, pagina: cx.pageName, mensaje: j });
    errores.push(`${cx.pageName}: ${j.error.message ?? "error"}`);
  }
  return NextResponse.json({ ok: false, error: errores.join(" | ") || "Sin páginas conectadas." });
}
