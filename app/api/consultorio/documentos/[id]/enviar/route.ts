import { NextResponse } from "next/server";
import { doctorActual } from "@/lib/consultorio/actual";
import { documentoPorId, guardarDocumento, pacientePorId } from "@/lib/consultorio/almacen";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mandarle al paciente lo que se le indicó.
//
// El proveedor de correo todavía NO está conectado, y eso se dice en la
// respuesta (`simulado: true`) en vez de dibujar un visto bueno: un "enviado"
// que no salió es la clase de mentira que se descubre cuando el paciente llega
// al laboratorio sin la orden.
//
// Cuando haya proveedor, lo único que cambia es el cuerpo de este if.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (tenantFromRequest(req) !== "consultorio") {
    return NextResponse.json({ ok: false, error: "No existe." }, { status: 404 });
  }
  const doctorId = (await doctorActual()).id;

  const { id } = await params;
  const doc = await documentoPorId(id);
  if (!doc || doc.doctorId !== doctorId) {
    return NextResponse.json({ ok: false, error: "Ese documento no existe." }, { status: 404 });
  }
  const paciente = await pacientePorId(doc.pacienteId);
  if (!paciente?.correo) {
    return NextResponse.json(
      { ok: false, error: "Este paciente no dejó correo al registrarse." },
      { status: 400 },
    );
  }

  const hayProveedor = Boolean(process.env.RESEND_API_KEY);
  await guardarDocumento({
    ...doc,
    enviado: { a: paciente.correo, cuando: new Date().toISOString(), simulado: !hayProveedor },
  });

  return NextResponse.json({
    ok: true,
    a: paciente.correo,
    simulado: !hayProveedor,
    ...(hayProveedor ? {} : { aviso: "Falta conectar el proveedor de correo: no salió nada." }),
  });
}
