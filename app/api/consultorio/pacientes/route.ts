import { NextResponse } from "next/server";
import { doctorActual } from "@/lib/consultorio/actual";
import { pacientesDe } from "@/lib/consultorio/almacen";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Los pacientes del doctor que se está viendo. Nunca los del otro.
//
// El módulo es de un solo cliente, así que la primera pregunta es si la sesión
// es de ese cliente: sin esto, la cuenta de otro tenant podría leer la lista de
// pacientes de la clínica escribiendo la URL a mano.
export async function GET(req: Request) {
  if (tenantFromRequest(req) !== "consultorio") {
    return NextResponse.json({ ok: false, error: "No existe." }, { status: 404 });
  }
  const doctor = await doctorActual();
  return NextResponse.json({ ok: true, pacientes: await pacientesDe(doctor.id) });
}
