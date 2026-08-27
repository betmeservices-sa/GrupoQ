// Los archivos de una ficha de contacto (fotos, comprobantes, documentos).
// GET ?from=<llave del contacto>

import { NextResponse } from "next/server";
import { listAdjuntos } from "@/lib/contacts-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const from = new URL(req.url).searchParams.get("from")?.trim();
  if (!from) return NextResponse.json({ ok: false, error: "Falta el contacto." }, { status: 400 });
  const adjuntos = await listAdjuntos(from);
  return NextResponse.json({
    ok: true,
    adjuntos: adjuntos.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      mime: a.mime,
      filename: a.filename,
      caption: a.caption,
      ts: a.ts,
      // Lo nuestro tiene url propia; lo de WhatsApp se baja de Meta por su media_id.
      url: a.url ?? (a.media_id ? `/api/whatsapp/media/${a.media_id}` : null),
    })),
  });
}
