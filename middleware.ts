// Frontera de seguridad de la app.
//
// Todo lo que cuelga de /api requiere sesion firmada, SALVO las rutas que
// tienen que ser publicas por diseno:
//   - los webhooks, que los llama Meta desde sus servidores (si se bloquean,
//     WhatsApp y Messenger dejan de entrar);
//   - el callback de OAuth, al que Meta redirige al navegador;
//   - el propio login/logout.
//
// Los webhooks NO quedan sin proteccion: validan la firma X-Hub-Signature-256
// de Meta en su propio handler.

import { NextResponse, type NextRequest } from "next/server";
import { sesionDeCookieHeader, verificarSesion } from "@/lib/session";

const PUBLICAS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/webhooks/",
  "/api/meta/callback",
];

function esPublica(pathname: string): boolean {
  return PUBLICAS.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p));
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api/") || esPublica(pathname)) {
    return NextResponse.next();
  }

  const tenant = await verificarSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!tenant) {
    return NextResponse.json(
      { error: "No autenticado. Inicia sesion para acceder a estos datos." },
      { status: 401 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
