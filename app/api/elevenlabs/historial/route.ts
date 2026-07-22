import { NextResponse } from "next/server";
import { fetchHistorialReciente, hayLlaveEleven } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

// Sondeo temporal: sirve para determinar si el uso de voz de Vapi aparece en el
// historial de ElevenLabs (y por tanto si se puede cruzar por llamada). Detras
// del middleware: exige sesion.
export async function GET() {
  if (!hayLlaveEleven()) {
    return NextResponse.json({ configurado: false });
  }
  try {
    const historial = await fetchHistorialReciente();
    return NextResponse.json({ configurado: true, historial });
  } catch (err) {
    return NextResponse.json(
      { configurado: true, historial: null, error: err instanceof Error ? err.message : "Error" },
      { status: 200 },
    );
  }
}
