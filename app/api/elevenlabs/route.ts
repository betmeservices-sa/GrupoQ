import { NextResponse } from "next/server";
import { fetchCuotaEleven, hayLlaveEleven, nombresRelacionados } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

// Endpoint aparte del de llamadas para que la latencia de ElevenLabs no frene
// la carga del dashboard. Queda detras del middleware: exige sesion.
export async function GET() {
  if (!hayLlaveEleven()) {
    // Diagnostico: que nombres de variables relacionadas ve el servidor (solo
    // nombres, sin valores). Ayuda a detectar un nombre mal escrito.
    return NextResponse.json({
      configurado: false,
      cuota: null,
      nombresVistos: nombresRelacionados(),
    });
  }
  try {
    const cuota = await fetchCuotaEleven();
    return NextResponse.json({ configurado: true, cuota });
  } catch (err) {
    return NextResponse.json(
      { configurado: true, cuota: null, error: err instanceof Error ? err.message : "Error" },
      { status: 200 },
    );
  }
}
