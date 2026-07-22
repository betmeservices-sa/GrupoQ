import { NextResponse } from "next/server";
import { sesionDeCookieHeader, verificarSesion } from "@/lib/session";

export const dynamic = "force-dynamic";

// Fuente de verdad de "estoy autenticado". El cliente pregunta aca en vez de
// confiar en localStorage: asi un estado viejo del navegador (sin cookie de
// sesion valida) NO renderiza un dashboard roto que dispara 401 por todos lados.
export async function GET(req: Request) {
  const tenant = await verificarSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!tenant) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, tenant });
}
