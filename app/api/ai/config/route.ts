import { NextResponse } from "next/server";
import { getAiEnabled, setAiEnabled } from "@/lib/ai-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estado actual del Modo IA (lo lee el toggle de la bandeja). No expone que
// credenciales estan configuradas: eso le da pistas a un atacante.
export async function GET() {
  return NextResponse.json({ enabled: await getAiEnabled() });
}

// Enciende/apaga el Modo IA global.
export async function POST(req: Request) {
  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  const enabled = Boolean(body.enabled);
  await setAiEnabled(enabled);
  return NextResponse.json({ ok: true, enabled });
}
