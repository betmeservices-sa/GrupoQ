import { NextResponse } from "next/server";
import { GRAPH } from "@/lib/meta-oauth";
import { conexionesDe } from "@/lib/meta-store";
import { addMetaOutbound, type MetaCanal } from "@/lib/meta-messages-store";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Envía un mensaje de Messenger o Instagram con el page token del tenant.
// Body: { canal, pageId, recipientId, texto }. Instagram se envía por el MISMO
// endpoint de mensajes de la página (la plataforma enruta por el IGSID del
// destinatario).
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
    return NextResponse.json(
      { ok: false, error: "La página no está conectada a este cliente" },
      { status: 404 },
    );
  }

  try {
    const r = await fetch(
      `${GRAPH}/${pageId}/messages?access_token=${encodeURIComponent(cx.pageToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_type: "RESPONSE",
          recipient: { id: recipientId },
          message: { text: texto },
        }),
      },
    );
    const d = await r.json().catch(() => ({}));
    if (!r.ok || d.error) {
      const motivo = d.error?.message ?? `HTTP ${r.status}`;
      console.error("[meta-send] Graph API falló:", motivo);
      return NextResponse.json({ ok: false, error: motivo }, { status: 502 });
    }

    const mid: string = d.message_id ?? `out-${canal}-${recipientId}-${Date.now()}`;
    // Persistimos con sender_id = destinatario: es la clave de la conversación
    // (mismo criterio que WhatsApp guarda los salientes bajo el número del cliente).
    await addMetaOutbound({
      mid,
      tenant,
      canal: canal as MetaCanal,
      pageId,
      senderId: recipientId,
      texto,
      ts: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, id: mid });
  } catch (e) {
    console.error("[meta-send] error de red:", e);
    return NextResponse.json({ ok: false, error: "Error de red" }, { status: 502 });
  }
}
