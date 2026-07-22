import { NextResponse } from "next/server";
import { validarCredenciales } from "@/lib/auth-server";
import { cookieDeSesion, crearSesion } from "@/lib/session";

export const dynamic = "force-dynamic";

// Login REAL: las credenciales se validan en el servidor y la sesion sale como
// cookie HttpOnly firmada. El navegador nunca decide si esta autenticado.
export async function POST(req: Request) {
  let usuario = "";
  let password = "";
  try {
    const body = (await req.json()) as { usuario?: string; password?: string };
    usuario = body.usuario ?? "";
    password = body.password ?? "";
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo invalido" }, { status: 400 });
  }

  const tenant = validarCredenciales(usuario, password);
  if (!tenant) {
    // Mensaje generico a proposito: no revelamos si el usuario existe.
    return NextResponse.json({ ok: false, error: "Credenciales invalidas" }, { status: 401 });
  }

  const { valor, maxAge } = await crearSesion(tenant);
  const res = NextResponse.json({ ok: true, tenant });
  res.headers.set("Set-Cookie", cookieDeSesion(valor, maxAge));
  return res;
}
