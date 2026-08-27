import { NextResponse } from "next/server";
import { conexionesDe } from "@/lib/meta-store";
import { enviarYGuardarMeta } from "@/lib/meta-enviar";
import { quienResponde } from "@/lib/staff-de-sesion";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Envía un mensaje de Messenger o Instagram desde el panel.
// Body: { canal, pageId, recipientId, texto }. Sale por la cuenta de Instagram
// si tiene login propio, si no por la página (lib/meta-enviar), y queda en el
// hilo firmado por la persona logueada.
export async function POST(req: Request) {
  let body: { canal?: string; pageId?: string; recipientId?: string; texto?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const canal = body.canal;
  const pageId = body.pageId?.trim();
  const recipientId = body.recipientId?.trim();
  const texto = body.texto?.trim();
  if (canal !== "facebook" && canal !== "instagram") {
    return NextResponse.json({ ok: false, error: "Canal inválido" }, { status: 400 });
  }
  if (!pageId || !/^\d+$/.test(pageId) || !recipientId || !/^\d+$/.test(recipientId)) {
    return NextResponse.json({ ok: false, error: "Faltan pageId o recipientId" }, { status: 400 });
  }
  if (!texto) {
    return NextResponse.json({ ok: false, error: "Falta el texto" }, { status: 400 });
  }
  if (texto.length > 2000) {
    return NextResponse.json({ ok: false, error: "Texto demasiado largo (max 2000)" }, { status: 400 });
  }

  // La página debe pertenecer al tenant del dashboard (cookie ccg_tenant).
  const tenant = tenantFromRequest(req);
  const cx = (await conexionesDe(tenant)).find((c) => c.pageId === pageId);
  if (!cx) {
    return NextResponse.json({ ok: false, error: "La página no está conectada a este cliente" }, { status: 404 });
  }

  const quien = await quienResponde(req, tenant);
  const mid = await enviarYGuardarMeta(cx, canal, recipientId, texto, quien);
  if (!mid) {
    return NextResponse.json({ ok: false, error: "Meta no aceptó el mensaje." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, id: mid, staffId: quien.staffId ?? null, staffNombre: quien.nombre ?? null });
}
