import { NextResponse } from "next/server";
import { getAiEnabled, setAiEnabled } from "@/lib/ai-store";
import { leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { VE } from "@/lib/modulos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estado actual del Modo IA (lo lee el toggle de la bandeja). No expone que
// credenciales estan configuradas: eso le da pistas a un atacante.
export async function GET() {
  return NextResponse.json({ enabled: await getAiEnabled() });
}

// Enciende/apaga el Modo IA global.
//
// Solo dirección. Esconder el botón en la barra es comodidad; esto es lo que
// impide que alguien lo apague con una petición a mano. Y no es un detalle:
// apagarlo deja al agente mudo para TODAS las conversaciones del cliente.
export async function POST(req: Request) {
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (sesion?.fijo && !(VE[sesion.rol] ?? []).includes("settings")) {
    return NextResponse.json(
      { ok: false, error: "Tu perfil no puede cambiar el Modo IA." },
      { status: 403 },
    );
  }

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
