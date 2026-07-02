import { NextResponse } from "next/server";
import { getChatAiActiva, getChatOverride, setChatOverride } from "@/lib/ai-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estado EFECTIVO de la IA para una conversacion (lo lee el toggle del hilo).
// GET ?from=<wa_from> -> { activa, overridden }
//   activa: si la IA respondera ese chat (su override si existe; si no, el global)
//   overridden: si el chat tiene un estado propio distinto del global
export async function GET(req: Request) {
  const from = new URL(req.url).searchParams.get("from")?.trim() || "";
  if (!from) return NextResponse.json({ activa: false, overridden: false });
  const ov = await getChatOverride(from);
  const activa = await getChatAiActiva(from);
  return NextResponse.json({ activa, overridden: ov !== null });
}

// POST { from, activa } -> fija el override de la IA para esa conversacion.
// activa=true la enciende (aunque el global este off); false la apaga.
export async function POST(req: Request) {
  let body: { from?: string; activa?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON invalido" }, { status: 400 });
  }
  const from = body.from?.trim();
  if (!from) {
    return NextResponse.json({ ok: false, error: "Falta 'from'" }, { status: 400 });
  }
  const activa = Boolean(body.activa);
  await setChatOverride(from, activa);
  return NextResponse.json({ ok: true, activa });
}
