import { NextResponse } from "next/server";
import { cookieDeSesion, crearSesion, leerSesion, sesionDeCookieHeader } from "@/lib/session";
import { isTenantId } from "@/lib/tenants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cambiar de cliente sin volver a entrar. Solo para cuentas de la agencia
// (tenant "*" en USUARIOS): la sesión trae la marca `todos`, que va dentro de
// la firma y no se puede poner desde el navegador. Se emite una sesión nueva,
// igual a la actual pero con el otro cliente.
export async function POST(req: Request) {
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  if (!sesion) return NextResponse.json({ ok: false, error: "No autenticado." }, { status: 401 });
  if (!sesion.todos) {
    return NextResponse.json({ ok: false, error: "Esta cuenta es de un solo cliente." }, { status: 403 });
  }

  let tenant = "";
  try {
    tenant = String(((await req.json()) as { tenant?: string }).tenant ?? "").trim();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }
  if (!isTenantId(tenant)) return NextResponse.json({ ok: false, error: "Cliente inválido." }, { status: 400 });

  const nueva = await crearSesion(tenant, sesion.rol, sesion.fijo, sesion.usuario ?? "", true);
  if (!nueva) return NextResponse.json({ ok: false, error: "El servidor no está configurado." }, { status: 503 });

  const res = NextResponse.json({ ok: true, tenant });
  res.headers.append("Set-Cookie", cookieDeSesion(nueva.valor, nueva.maxAge, req.headers.get("host")));
  return res;
}
