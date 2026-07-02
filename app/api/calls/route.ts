import { NextResponse } from "next/server";
import { fetchVapiCalls, hayLlaveVapi, resumirLlamadas } from "@/lib/vapi";

// Jala el estado actual de las llamadas en cada request (datos en vivo).
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const calls = await fetchVapiCalls();
    return NextResponse.json({
      source: hayLlaveVapi() ? "vapi" : "demo",
      metrics: resumirLlamadas(calls),
      // Vapi devuelve las más recientes primero; recortamos para la lista.
      calls: calls.slice(0, 25),
    });
  } catch (err) {
    return NextResponse.json(
      {
        source: "error",
        error: err instanceof Error ? err.message : "Error desconocido",
        metrics: null,
        calls: [],
      },
      { status: 502 },
    );
  }
}
