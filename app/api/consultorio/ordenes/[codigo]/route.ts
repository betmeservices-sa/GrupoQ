import { NextResponse } from "next/server";
import { sucursalActual } from "@/lib/consultorio/actual";
import {
  crearTurno,
  documentoPorCodigo,
  doctorPorId,
  pacientePorId,
  sucursalPorId,
  tipoDeOrdenDe,
  turnosDe,
} from "@/lib/consultorio/almacen";
import { TODOS } from "@/lib/consultorio/catalogos";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La orden del doctor, para el mostrador.
//
// GET la muestra: recepción escribe el código que trae el paciente y ve qué le
// mandaron, de quién es y quién se lo mandó, antes de tocar nada.
//
// POST lo mete en la fila con esos exámenes ya marcados, que es el trabajo que
// esto ahorra: sin el código hay que leer la letra del doctor y marcar quince
// casillas a mano.

async function buscar(codigo: string) {
  const doc = await documentoPorCodigo(codigo);
  if (!doc || doc.tipo === "receta") return null;
  const paciente = await pacientePorId(doc.pacienteId);
  return { doc, paciente, doctor: doctorPorId(doc.doctorId) };
}

/** En qué mostrador se está preguntando. */
async function unidadDe(req: Request) {
  const pedida = new URL(req.url).searchParams.get("unidad");
  return (pedida ? sucursalPorId(pedida) : null) ?? (await sucursalActual());
}

export async function GET(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  if (tenantFromRequest(req) !== "consultorio") {
    return NextResponse.json({ ok: false, error: "No existe." }, { status: 404 });
  }
  const { codigo } = await params;
  const hallado = await buscar(codigo);
  if (!hallado) {
    return NextResponse.json({ ok: false, error: "Ese código no existe." }, { status: 404 });
  }
  const { doc, paciente, doctor } = hallado;

  // Si ya está en la fila de hoy, lo que hace falta es abrir su récord, no
  // meterlo otra vez.
  const sucursal = await unidadDe(req);
  const yaEnFila = (await turnosDe(sucursal.id)).find(
    (t) => paciente && t.telefono === paciente.telefono,
  );

  // Una orden de laboratorio no se atiende en imagenología: se dice acá, en
  // vez de dejar que registren a alguien por estudios que esa unidad no hace.
  const suya = doc.tipo === tipoDeOrdenDe(sucursal.tipo);

  return NextResponse.json({
    ok: true,
    suya,
    unidad: sucursal.nombre,
    orden: {
      codigo: doc.codigo,
      tipo: doc.tipo,
      fecha: doc.fecha,
      examenes: doc.examenes.filter((e) => e in TODOS),
      indicaciones: doc.indicaciones,
    },
    paciente: paciente ? { nombre: paciente.nombre, telefono: paciente.telefono } : null,
    doctor: doctor?.nombre ?? "",
    turnoId: yaEnFila?.id ?? null,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ codigo: string }> }) {
  if (tenantFromRequest(req) !== "consultorio") {
    return NextResponse.json({ ok: false, error: "No existe." }, { status: 404 });
  }
  const { codigo } = await params;
  const hallado = await buscar(codigo);
  if (!hallado?.paciente) {
    return NextResponse.json({ ok: false, error: "Ese código no existe." }, { status: 404 });
  }
  const { doc, paciente } = hallado;

  const examenes = doc.examenes.filter((e) => e in TODOS);
  if (examenes.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Esa orden no trae nada que esta unidad haga." },
      { status: 400 },
    );
  }

  const sucursal = await unidadDe(req);
  if (doc.tipo !== tipoDeOrdenDe(sucursal.tipo)) {
    return NextResponse.json(
      { ok: false, error: `Esa orden no es de ${sucursal.nombre}.` },
      { status: 400 },
    );
  }
  const turno = await crearTurno({
    sucursalId: sucursal.id,
    nombre: paciente.nombre,
    telefono: paciente.telefono,
    correo: paciente.correo,
    examenes,
  });

  return NextResponse.json({ ok: true, turno });
}
