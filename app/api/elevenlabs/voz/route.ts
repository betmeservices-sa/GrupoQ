import { NextResponse } from "next/server";
import { fetchVozEstado, hayLlaveEleven } from "@/lib/elevenlabs";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!hayLlaveEleven()) return NextResponse.json({ configurado: false });
  const id = new URL(req.url).searchParams.get("id") || "qO4CSH9mbCZnV8sWQTpn";
  try {
    return NextResponse.json({ configurado: true, voz: await fetchVozEstado(id) });
  } catch (err) {
    return NextResponse.json({ configurado: true, voz: null, error: err instanceof Error ? err.message : "Error" });
  }
}
