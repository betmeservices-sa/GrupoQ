import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { credencialesWa } from "@/lib/wa-credenciales";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

// Muestra "escribiendo..." en el WhatsApp del cliente.
// Body: { messageId: "<wamid del último mensaje recibido>" }.
// Meta marca ese mensaje como leído y muestra el indicador hasta 25s o hasta
// que envíes la respuesta, lo que ocurra primero.
export async function POST(req: Request) {
  const credenciales = await credencialesWa(tenantFromRequest(req));
  if (!credenciales) {
    return NextResponse.json(
      { ok: false, error: "Este cliente no tiene un número de WhatsApp conectado." },
      { status: 500 },
    );
  }
  const { token, phoneId } = credenciales;

  let body: { messageId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const messageId = body.messageId?.trim();
  if (!messageId) {
    return NextResponse.json({ ok: false, error: "Falta 'messageId'" }, { status: 400 });
  }

  const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
      typing_indicator: { type: "text" },
    }),
  });

  const data: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error =
      (data as { error?: { message?: string } })?.error?.message ?? `Graph respondió ${res.status}`;
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
