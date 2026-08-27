import { NextResponse } from "next/server";
import { leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { TENANTS } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Quien entro y con que rol.
//
// Lo pregunta el panel al cargar, para pintar el menu con lo que esa persona
// puede ver. NO es la seguridad: la puerta la cierra el middleware. Esto es
// para que la pantalla coincida con la realidad en vez de mostrar modulos que
// al tocarlos rebotan.
export async function GET(req: Request) {
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!sesion) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    tenant: sesion.tenant,
    rol: sesion.rol,
    // true = cuenta de una persona: el rol no se cambia desde el navegador.
    fijo: sesion.fijo,
    // Cuenta de la agencia: puede cambiar de cliente, y acá va la lista.
    todos: sesion.todos,
    clientes: sesion.todos
      ? Object.entries(TENANTS).map(([id, t]) => ({ id, nombre: t.brand.nombreCorto || t.brand.nombre }))
      : undefined,
  });
}
