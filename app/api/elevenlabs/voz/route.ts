import { NextResponse } from "next/server";
import { fetchVozEstado, hayLlaveEleven } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

// Sondeo temporal: estado de fine-tuning de una voz de ElevenLabs. Detras del
// middleware: exige sesion.
export async function GET(req: Request) {
  if (!hayLlaveEleven()) {
    return NextResponse.json({ configurado: false });
  }
  const id = new URL(req.url).searchParams.get("id") || "qO4CSH9mbCZnV8sWQTpn";
  try {
    const voz = await fetchVozEstado(id);
    return NextResponse.json({ configurado: true, voz });
  } catch (err) {
    return NextResponse.json({
      configurado: true,
      voz: null,
      error: err instanceof Error ? err.message : "Error",
    });
  }
}
