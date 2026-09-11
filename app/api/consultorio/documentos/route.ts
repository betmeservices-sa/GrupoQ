import { NextResponse } from "next/server";
import { doctorActual } from "@/lib/consultorio/actual";
import {
  documentosDe,
  documentosDeDoctor,
  guardarDocumento,
  pacientePorId,
} from "@/lib/consultorio/almacen";
import { esExamen } from "@/lib/consultorio/examenes";
import { idNuevo, type Documento, type Medicamento } from "@/lib/consultorio/tipos";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lo que el doctor le deja escrito al paciente: una receta o una orden de
// exámenes. Las dos comparten ruta porque comparten todo lo demás (de quién es,
// para quién, cuándo y si ya se envió); lo único que cambia es el contenido.

function ajeno(req: Request): boolean {
  return tenantFromRequest(req) !== "consultorio";
}

export async function GET(req: Request) {
  if (ajeno(req)) return NextResponse.json({ ok: false, error: "No existe." }, { status: 404 });
  const doctorId = (await doctorActual()).id;

  // Sin paciente: todo lo que el doctor ha dejado escrito, con el nombre de
  // cada quien pegado. La pantalla de recetas necesita saber de quién es cada
  // una, y resolverlo ahí serían tantas consultas como documentos.
  const pacienteId = new URL(req.url).searchParams.get("paciente") ?? "";
  if (!pacienteId) {
    const docs = await documentosDeDoctor(doctorId);
    const nombres = new Map<string, string>();
    for (const d of docs) {
      if (!nombres.has(d.pacienteId)) {
        nombres.set(d.pacienteId, (await pacientePorId(d.pacienteId))?.nombre ?? "Paciente borrado");
      }
    }
    const documentos = docs.map((d) => ({ ...d, pacienteNombre: nombres.get(d.pacienteId)! }));
    return NextResponse.json({ ok: true, documentos });
  }

  const paciente = await pacientePorId(pacienteId);
  // Un paciente de otro doctor se responde igual que uno que no existe: si se
  // distinguiera, el mensaje de error confirmaría que ese expediente existe.
  if (!paciente || paciente.doctorId !== doctorId) {
    return NextResponse.json({ ok: false, error: "Ese paciente no existe." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, documentos: await documentosDe(paciente.id) });
}

export async function POST(req: Request) {
  if (ajeno(req)) return NextResponse.json({ ok: false, error: "No existe." }, { status: 404 });
  const doctorId = (await doctorActual()).id;

  const b = (await req.json().catch(() => ({}))) as {
    tipo?: string;
    pacienteId?: string;
    medicamentos?: Medicamento[];
    examenes?: string[];
    diagnostico?: string;
    indicaciones?: string;
  };

  const paciente = await pacientePorId(b.pacienteId ?? "");
  if (!paciente || paciente.doctorId !== doctorId) {
    return NextResponse.json({ ok: false, error: "Ese paciente no existe." }, { status: 404 });
  }

  const comun = {
    id: idNuevo(b.tipo === "receta" ? "rec" : "ord"),
    pacienteId: paciente.id,
    doctorId,
    fecha: new Date().toISOString(),
    indicaciones: (b.indicaciones ?? "").trim(),
    enviado: null,
  };

  let doc: Documento;
  if (b.tipo === "receta") {
    // Un medicamento sin nombre no es un medicamento; el resto de los campos
    // pueden ir vacíos porque no siempre aplican (una crema no lleva duración).
    const medicamentos = (b.medicamentos ?? [])
      .map((m) => ({
        nombre: (m.nombre ?? "").trim(),
        dosis: (m.dosis ?? "").trim(),
        frecuencia: (m.frecuencia ?? "").trim(),
        duracion: (m.duracion ?? "").trim(),
      }))
      .filter((m) => m.nombre);
    if (medicamentos.length === 0) {
      return NextResponse.json({ ok: false, error: "La receta va vacía." }, { status: 400 });
    }
    doc = { ...comun, tipo: "receta", medicamentos };
  } else {
    // Solo ids del catálogo: lo que no está en la lista no se guarda, para que
    // la orden impresa no pueda pedir un examen que no existe.
    const examenes = [...new Set(b.examenes ?? [])].filter(esExamen);
    if (examenes.length === 0) {
      return NextResponse.json({ ok: false, error: "No marcaste ningún examen." }, { status: 400 });
    }
    doc = { ...comun, tipo: "orden", examenes, diagnostico: (b.diagnostico ?? "").trim() };
  }

  return NextResponse.json({ ok: true, documento: await guardarDocumento(doc) });
}
