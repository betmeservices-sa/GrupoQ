import { NextResponse } from "next/server";
import {
  documentosDePacientes,
  listarDoctores,
  listarSucursales,
  pacientesPorCorreo,
} from "@/lib/consultorio/almacen";
import { armarPortal, demasiados, normalizarCorreo } from "@/lib/consultorio/portal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El portal del paciente: entra con su correo y le salen sus recetas y órdenes.
//
// PÚBLICO a propósito, igual que el registro: quien pregunta no tiene cuenta.
// Va por POST para que el correo no quede en la URL ni en los logs de acceso, y
// con freno por IP para que no se puedan probar correos en bucle. Lo que
// devuelve lo recorta portal.ts: ni teléfonos ni diagnóstico.
const golpes = new Map<string, number[]>();

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") ?? "sin-ip").split(",")[0].trim();
  if (demasiados(golpes, ip, Date.now())) {
    return NextResponse.json(
      { ok: false, error: "Demasiados intentos seguidos. Probá de nuevo en unos minutos." },
      { status: 429 },
    );
  }

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const correo = normalizarCorreo(String(b.correo ?? ""));
  if (!correo) {
    return NextResponse.json({ ok: false, error: "Escribí el correo completo." }, { status: 400 });
  }

  const pacientes = await pacientesPorCorreo(correo);
  if (pacientes.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "No encontramos ese correo. Tiene que ser el mismo que dejaste al registrarte con el doctor.",
      },
      { status: 404 },
    );
  }

  const documentos = await documentosDePacientes(pacientes.map((p) => p.id));
  return NextResponse.json({
    ok: true,
    portal: armarPortal(pacientes, documentos, listarDoctores(), listarSucursales()),
  });
}
