import { NextResponse } from "next/server";
import { COOKIE_DOCTOR, cookieDeUnidad } from "@/lib/consultorio/actual";
import { doctorPorId, sucursalPorId } from "@/lib/consultorio/almacen";
import { tenantFromRequest } from "@/lib/tenants/server";
import type { TipoUnidad } from "@/lib/consultorio/tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cambiar de escritorio: con cuál de los dos doctores o de las dos sucursales
// se está mirando el módulo. La clínica es una sola; esto no abre ninguna
// puerta, solo elige a quién se le está viendo la agenda.
export async function GET(req: Request) {
  if (tenantFromRequest(req) !== "consultorio") {
    return NextResponse.json({ ok: false, error: "No existe." }, { status: 404 });
  }

  const url = new URL(req.url);
  const que = url.searchParams.get("que");
  const id = url.searchParams.get("id") ?? "";
  const destino = url.searchParams.get("a") ?? "/consultorio";

  // Solo rutas internas: sin esto, un enlace con ?a=https://otro-sitio
  // convertiría esto en un redirector abierto.
  const seguro = destino.startsWith("/") && !destino.startsWith("//") ? destino : "/consultorio";

  if (que !== "doctor" && que !== "sucursal") {
    return NextResponse.json({ ok: false, error: "Eso no se puede cambiar." }, { status: 400 });
  }
  const existe = que === "doctor" ? doctorPorId(id) : sucursalPorId(id);
  if (!existe) {
    return NextResponse.json({ ok: false, error: "Eso no existe." }, { status: 404 });
  }

  const res = NextResponse.redirect(new URL(seguro, url.origin), { status: 302 });
  const galleta =
    que === "doctor" ? COOKIE_DOCTOR : cookieDeUnidad((existe as { tipo: TipoUnidad }).tipo);
  res.cookies.set(galleta, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 12 * 3600,
  });
  return res;
}
