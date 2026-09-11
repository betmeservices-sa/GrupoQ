import { NextResponse } from "next/server";
import { sucursalActual } from "@/lib/consultorio/actual";
import { turnosDe } from "@/lib/consultorio/almacen";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La fila de hoy, para el mostrador del laboratorio.
export async function GET(req: Request) {
  if (tenantFromRequest(req) !== "consultorio") {
    return NextResponse.json({ ok: false, error: "No existe." }, { status: 404 });
  }
  const sucursal = await sucursalActual();
  return NextResponse.json({ ok: true, turnos: await turnosDe(sucursal.id) });
}
