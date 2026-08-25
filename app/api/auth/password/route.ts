import { NextResponse } from "next/server";
import { leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { cambiarClave, yaCambioClave } from "@/lib/usuarios-clave";
import { cuentaDeUsuario } from "@/lib/usuarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ¿Esta persona todavía tiene la contraseña que le dimos nosotros?
export async function GET(req: Request) {
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!sesion?.usuario) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({
    ok: true,
    usuario: sesion.usuario,
    propia: await yaCambioClave(sesion.usuario),
  });
}

// Cambia la contraseña de quien tiene la sesión abierta.
//
// El usuario sale de la cookie firmada, NUNCA del cuerpo del pedido: si viniera
// del cliente, cualquiera con una sesión podría cambiarle la clave a otro.
export async function POST(req: Request) {
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!sesion?.usuario) {
    return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { actual?: string; nueva?: string };
  const actual = String(body.actual ?? "");
  const nueva = String(body.nueva ?? "");
  if (!actual || !nueva) {
    return NextResponse.json({ ok: false, error: "Faltan datos." }, { status: 400 });
  }

  // La clave inicial solo sirve la primera vez, cuando todavía no hay una
  // propia contra la cual comparar la actual.
  const cuenta = cuentaDeUsuario(sesion.usuario);
  const r = await cambiarClave(sesion.usuario, actual, nueva, cuenta?.password ?? null);

  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
