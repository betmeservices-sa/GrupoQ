import { NextResponse } from "next/server";
import { doctorActual } from "@/lib/consultorio/actual";
import {
  documentoPorId,
  doctorPorId,
  guardarDocumento,
  pacientePorId,
} from "@/lib/consultorio/almacen";
import { armarCorreo, mandarPorN8n } from "@/lib/consultorio/correo";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mandarle al paciente lo que se le indicó.
//
// El envío lo hace n8n: se le entrega el correo ya redactado al webhook
// `<N8N_WEBHOOK_BASE>/consultorio-correo`. Si no hay base configurada, o si n8n
// contesta mal, la respuesta dice con todas sus letras que el correo NO salió
// (`simulado: true`) en vez de dibujar un visto bueno. Un "enviado" que no se
// envió es la clase de mentira que se descubre cuando el paciente llega a la
// farmacia sin la receta.
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
  const doctor = doctorPorId(doc.doctorId);
  if (!doctor) {
    return NextResponse.json({ ok: false, error: "Ese documento no existe." }, { status: 404 });
  }

  const { salio, porque } = await mandarPorN8n(armarCorreo(doc, paciente, doctor));

  await guardarDocumento({
    ...doc,
    enviado: { a: paciente.correo, cuando: new Date().toISOString(), simulado: !salio },
  });

  return NextResponse.json({
    ok: true,
    a: paciente.correo,
    simulado: !salio,
    ...(salio ? {} : { aviso: porque }),
  });
}
