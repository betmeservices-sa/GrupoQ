import { NextResponse } from "next/server";
import { addOutbound } from "@/lib/wa-store";
import { addAdjunto } from "@/lib/contacts-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

// POST multipart/form-data: campos `to` (string), `file` (archivo), `caption` (opcional).
// Sube el archivo a Meta y envía un mensaje de tipo image o document.
// Respuesta exitosa: { ok: true, id }
// Error de Graph: { ok: false, error } con status 502
// Sin credenciales: 500
export async function POST(req: Request) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return NextResponse.json(
      { ok: false, error: "Faltan WHATSAPP_ACCESS_TOKEN o WHATSAPP_PHONE_NUMBER_ID" },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "FormData invalido" }, { status: 400 });
  }

  const toRaw = formData.get("to");
  const fileRaw = formData.get("file");
  const captionRaw = formData.get("caption");

  const to = typeof toRaw === "string" ? toRaw.trim() : "";
  if (!to) {
    return NextResponse.json({ ok: false, error: "Falta campo 'to'" }, { status: 400 });
  }
  if (!/^\d{8,15}$/.test(to)) {
    return NextResponse.json({ ok: false, error: "Numero invalido" }, { status: 400 });
  }
  if (!(fileRaw instanceof File)) {
    return NextResponse.json({ ok: false, error: "Falta campo 'file'" }, { status: 400 });
  }

  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
  if (fileRaw.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Archivo demasiado grande (max 5 MB)" },
      { status: 413 },
    );
  }

  const mime = fileRaw.type || "application/octet-stream";
  const MIME_PERMITIDOS = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ]);
  if (!MIME_PERMITIDOS.has(mime)) {
    return NextResponse.json(
      { ok: false, error: "Tipo de archivo no permitido (solo imagen o PDF)" },
      { status: 415 },
    );
  }

  const caption = typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim() : undefined;
  const filename = fileRaw.name || "archivo";
  const esImagen = mime.startsWith("image/");

  // 1. Subir el archivo a Meta Media API.
  const uploadForm = new FormData();
  uploadForm.set("messaging_product", "whatsapp");
  uploadForm.set("type", mime);
  uploadForm.set("file", fileRaw, filename);

  const uploadRes = await fetch(`${GRAPH}/${phoneId}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: uploadForm,
  });

  const uploadData: unknown = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok) {
    const error =
      (uploadData as { error?: { message?: string } })?.error?.message ??
      `Meta media upload respondio ${uploadRes.status}`;
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }

  const mediaId = (uploadData as { id?: string })?.id;
  if (!mediaId) {
    return NextResponse.json(
      { ok: false, error: "Meta no devolvio media id" },
      { status: 502 },
    );
  }

  // 2. Enviar el mensaje con el media id.
  const messageBody: Record<string, unknown> = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
  };

  if (esImagen) {
    messageBody.type = "image";
    messageBody.image = { id: mediaId, ...(caption ? { caption } : {}) };
  } else {
    messageBody.type = "document";
    messageBody.document = {
      id: mediaId,
      filename,
      ...(caption ? { caption } : {}),
    };
  }

  const sendRes = await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messageBody),
  });

  const sendData: unknown = await sendRes.json().catch(() => ({}));
  if (!sendRes.ok) {
    const error =
      (sendData as { error?: { message?: string } })?.error?.message ??
      `Meta messages respondio ${sendRes.status}`;
    return NextResponse.json({ ok: false, error }, { status: 502 });
  }

  const msgId = (sendData as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id;
  if (!msgId) {
    return NextResponse.json(
      { ok: false, error: "Meta no devolvio id de mensaje" },
      { status: 502 },
    );
  }

  const ts = new Date().toISOString();
  const textoFallback = esImagen ? "[imagen enviada]" : "[documento enviado]";

  // 3. Persistir en stores.
  await addOutbound({
    waId: msgId,
    to,
    texto: caption ?? textoFallback,
    ts,
  });

  await addAdjunto({
    from: to,
    tipo: esImagen ? "image" : "document",
    mediaId,
    mime,
    filename,
    caption,
    ts,
  });

  return NextResponse.json({ ok: true, id: msgId });
}
