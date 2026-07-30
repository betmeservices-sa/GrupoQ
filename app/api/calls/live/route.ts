import { NextResponse } from "next/server";
import { fetchLlamadasEnCurso } from "@/lib/vapi-live";

// Endpoint liviano para el indicador "en vivo". No persiste nada ni calcula
// metricas: solo responde si hay alguien en linea ahora mismo.
export const dynamic = "force-dynamic";

export async function GET() {
  const estado = await fetchLlamadasEnCurso();
  return NextResponse.json(estado, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
