import { NextResponse } from "next/server";
import { doctorActual } from "@/lib/consultorio/actual";
import {
  documentosDe,
  documentosDeDoctor,
  guardarDocumento,
  pacientePorId,
} from "@/lib/consultorio/almacen";
import { LADOS, TODOS, esDe, type Lado, type TipoOrden } from "@/lib/consultorio/catalogos";
import { codigoReceta, idNuevo, type Documento, type Medicamento } from "@/lib/consultorio/tipos";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lo que el doctor le deja escrito al paciente: una receta, o una orden de
// laboratorio, de imagenología o de procedimiento. Comparten ruta porque
// comparten todo lo demás (de quién es, para quién, cuándo, con qué código y si
// ya se envió); lo único que cambia es de cuál catálogo salen los ítems.

const TIPOS: TipoOrden[] = ["orden", "imagen", "proceso"];

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
    lados?: Record<string, string>;
    diagnostico?: string;
    indicaciones?: string;
  };

  const paciente = await pacientePorId(b.pacienteId ?? "");
  if (!paciente || paciente.doctorId !== doctorId) {
    return NextResponse.json({ ok: false, error: "Ese paciente no existe." }, { status: 404 });
  }

  const comun = {
    id: idNuevo(b.tipo === "receta" ? "rec" : b.tipo === "imagen" ? "img" : b.tipo === "proceso" ? "prc" : "ord"),
    pacienteId: paciente.id,
    doctorId,
    fecha: new Date().toISOString(),
    // Todo documento nace con su código, también la receta: es lo que el
    // paciente lleva encima, y no vale la pena que unos tengan y otros no.
    codigo: codigoReceta(),
    indicaciones: (b.indicaciones ?? "").trim(),
    enviado: null,
  };

  const tipo = TIPOS.includes(b.tipo as TipoOrden) ? (b.tipo as TipoOrden) : null;

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
  } else if (tipo) {
    // Solo ids del catálogo QUE CORRESPONDE: lo que no está en esa lista no se
    // guarda, para que una orden impresa no pueda pedir algo que no existe, ni
    // meter un ultrasonido en una orden de laboratorio.
    const examenes = [...new Set(b.examenes ?? [])].filter((e) => esDe(tipo, e));
    if (examenes.length === 0) {
      return NextResponse.json({ ok: false, error: "No marcaste nada." }, { status: 400 });
    }
    // El lado solo se guarda de los estudios que lo piden, y solo si es uno de
    // los tres válidos: un "lado" pegado a una radiografía de tórax sería ruido
    // en la hoja, y uno inventado sería una instrucción que nadie puede seguir.
    const lados: Record<string, Lado> = {};
    for (const id of examenes) {
      const valor = b.lados?.[id];
      if (TODOS[id]?.lado && LADOS.some((l) => l.id === valor)) lados[id] = valor as Lado;
    }
    const falta = examenes.filter((id) => TODOS[id]?.lado && !lados[id]);
    if (falta.length > 0) {
      return NextResponse.json(
        { ok: false, error: "Falta decir de qué lado va cada estudio." },
        { status: 400 },
      );
    }
    doc = { ...comun, tipo, examenes, lados, diagnostico: (b.diagnostico ?? "").trim() };
  } else {
    return NextResponse.json({ ok: false, error: "Ese tipo no existe." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, documento: await guardarDocumento(doc) });
}
