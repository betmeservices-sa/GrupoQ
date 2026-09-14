import { NextResponse } from "next/server";
import { documentoPorCodigo, doctorPorId, pacientePorId } from "@/lib/consultorio/almacen";
import { TODOS } from "@/lib/consultorio/catalogos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La orden que el paciente trae del doctor, buscada por su código.
//
// PÚBLICA porque la usa el propio paciente desde su teléfono, en la entrada del
// laboratorio, para no volver a marcar a mano lo que el doctor ya le indicó.
// Quien tiene el código tiene el papel: es la misma información que lleva
// impresa en la mano.
//
// Devuelve lo justo para llenar el formulario: su nombre, qué le mandaron y
// quién se lo mandó. NO devuelve teléfono ni correo: eso no hace falta para
// marcar exámenes, y un código es más fácil de teclear que de robar.
export async function GET(_req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const doc = await documentoPorCodigo(codigo);
  if (!doc || doc.tipo === "receta") {
    return NextResponse.json({ ok: false, error: "Ese código no existe." }, { status: 404 });
  }

  const paciente = await pacientePorId(doc.pacienteId);
  const doctor = doctorPorId(doc.doctorId);

  return NextResponse.json({
    ok: true,
    codigo: doc.codigo,
    tipo: doc.tipo,
    fecha: doc.fecha,
    nombre: paciente?.nombre ?? "",
    doctor: doctor?.nombre ?? "",
    // Solo los que existen hoy en el catálogo: una orden vieja puede traer un
    // examen que el laboratorio ya no hace, y marcar algo inexistente dejaría
    // al paciente en la fila esperando por lo que nadie le va a tomar.
    examenes: doc.examenes.filter((e) => e in TODOS),
  });
}
