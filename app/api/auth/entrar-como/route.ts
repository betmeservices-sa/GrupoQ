// Entrar como una persona SIN contraseña. SOLO en desarrollo local.
//
// Para ver el panel exactamente como lo ve Verónica u Olga sin pedirles su
// clave. En producción esta ruta no existe (404): abrirla ahí sería regalar
// cualquier cuenta a quien conozca la URL.
//
//   http://localhost:3200/api/auth/entrar-como?usuario=veronica.viches@yalihospitality.com

import { NextResponse } from "next/server";
import { cuentaDeUsuario } from "@/lib/usuarios";
import { crearSesion, cookieDeSesion } from "@/lib/session";
import { registrarAcceso } from "@/lib/accesos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    return new Response("No existe", { status: 404 });
  }
  const url = new URL(req.url);
  const usuario = (url.searchParams.get("usuario") ?? "").trim().toLowerCase();
  const cuenta = usuario ? cuentaDeUsuario(usuario) : null;
  if (!cuenta) return new Response("Usuario desconocido", { status: 404 });
  const sesion = await crearSesion(cuenta.tenant, cuenta.rol, true, cuenta.usuario, cuenta.todos === true);
  if (!sesion) return new Response("Falta SESSION_SECRET", { status: 503 });
  await registrarAcceso({ tenant: cuenta.tenant, usuario: cuenta.usuario, nombre: cuenta.nombre, rol: cuenta.rol, todos: cuenta.todos === true, host: "localhost (entrar-como)", ip: null, agente: null });
  const res = NextResponse.redirect(new URL("/", req.url));
  res.headers.append("Set-Cookie", cookieDeSesion(sesion.valor, sesion.maxAge, req.headers.get("host")));
  return res;
}
