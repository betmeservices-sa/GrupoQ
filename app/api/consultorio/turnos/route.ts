import { NextResponse } from "next/server";
import { sucursalActual } from "@/lib/consultorio/actual";
import { sucursalPorId, turnosDe } from "@/lib/consultorio/almacen";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La fila de hoy del mostrador que pregunta.
//
// La unidad viene en la URL porque hay tres departamentos abiertos a la vez
// (laboratorio, imagenología y procedimientos) y cada uno mira SU fila; sin
// eso, abrir imagenología mostraría la cola del laboratorio.
export async function GET(req: Request) {
  if (tenantFromRequest(req) !== "consultorio") {
    return NextResponse.json({ ok: false, error: "No existe." }, { status: 404 });
  }
  const pedida = new URL(req.url).searchParams.get("unidad");
  const unidad = (pedida ? sucursalPorId(pedida) : null) ?? (await sucursalActual());
  return NextResponse.json({ ok: true, unidad: unidad.id, turnos: await turnosDe(unidad.id) });
}
