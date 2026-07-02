import { NextResponse } from "next/server";
import { enviarReaccion } from "@/lib/wa-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST body: { to, messageId, emoji }
// -> { ok: true }
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalido" }, { status: 400 });
  }

  const to = typeof body.to === "string" ? body.to.trim() : "";
  const messageId = typeof body.messageId === "string" ? body.messageId.trim() : "";
  const emoji = typeof body.emoji === "string" ? body.emoji.trim() : "";

  if (!to || !messageId || !emoji) {
    return NextResponse.json(
      { ok: false, error: "Faltan campos: to, messageId, emoji" },
      { status: 400 },
    );
  }

  await enviarReaccion(to, messageId, emoji);
  return NextResponse.json({ ok: true });
}
