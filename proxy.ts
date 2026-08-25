// Frontera de seguridad de la app.
//
// Se llama proxy.ts y no middleware.ts porque en Next 16 ese nombre quedo
// deprecado. No es cosmetico: con el nombre viejo seguia corriendo para /api
// pero NO para las paginas, asi que las rutas cerradas por rol devolvian 200
// igual. Se veia como si la restriccion no existiera.
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
import { leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { MODULO_RUTA, primerModulo, puedeVerRuta, VE } from "@/lib/modulos";

const PUBLICAS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/webhooks/",
  "/api/meta/callback",
  // Lo llama el sitio de miagentia.com, que no tiene sesion. Se defiende solo:
  // lista cerrada de clientes, tope de tamano y freno por IP.
  "/api/onboarding",
];

function esPublica(pathname: string): boolean {
  return PUBLICAS.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p));
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));

  if (pathname.startsWith("/api/")) {
    if (esPublica(pathname)) return NextResponse.next();
    if (!sesion) {
      return NextResponse.json(
        { error: "No autenticado. Inicia sesion para acceder a estos datos." },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // Paginas. Solo se cierran cuando la sesion trae un rol FIJO, o sea una
  // cuenta de una persona. Los logins de demo siguen viendo todo y con su
  // selector de "ver como", porque son para enseñar el producto.
  //
  // Esto es lo que de verdad cierra la puerta: esconder el modulo del menu es
  // comodidad, y no impide escribir la URL a mano.
  if (sesion?.fijo && !puedeVerRuta(sesion.rol, pathname)) {
    const destino = MODULO_RUTA[primerModulo({ ve: VE[sesion.rol] ?? [] })];
    return NextResponse.redirect(new URL(destino, req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Las paginas tambien, no solo /api: la restriccion por rol se aplica al
  // navegar. Se dejan fuera los assets y el login, que no tienen modulo.
  // Ojo con el patron: en una cadena de TypeScript, "\." se escribe con DOS
  // barras. Con una sola, JavaScript se la come y "\.*\." queda como ".*.",
  // que matchea cualquier cosa y hace que el lookahead descarte TODAS las
  // paginas. Se veia como si el proxy no corriera. Por eso aca no se excluye
  // por extension: se listan los prefijos y ya.
  matcher: ["/api/:path*", "/((?!_next|favicon|login).*)"],
};
