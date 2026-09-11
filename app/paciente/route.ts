import { NextResponse } from "next/server";
import { sucursalActual } from "@/lib/consultorio/actual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La tercera vista: lo que ve el paciente en su teléfono.
//
// Es un atajo, no una pantalla: manda a la página pública de la sucursal. Va
// SIN sesión, igual que la página a la que lleva, porque el punto es poder
// abrirla o mandarla por WhatsApp sin que nadie tenga que entrar a nada. Si hay
// sesión de mostrador, respeta la sucursal que se esté mirando; si no, cae en
// la primera.
export async function GET(req: Request) {
  const sucursal = await sucursalActual();
  return NextResponse.redirect(new URL(`/s/${sucursal.codigo}`, new URL(req.url).origin));
}
