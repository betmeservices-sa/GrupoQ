import { NextResponse } from "next/server";
import {
  crearTurno,
  cuantosDelante,
  sucursalPorCodigo,
  tipoDeOrdenDe,
} from "@/lib/consultorio/almacen";
import { esDe } from "@/lib/consultorio/catalogos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Alguien acaba de escanear el QR de la entrada del laboratorio y pide turno.
//
// PÚBLICO a propósito: quien llega no tiene cuenta. En qué sucursal cae lo
// decide el CÓDIGO del QR, nunca un campo del formulario: si viniera en el
// cuerpo, cualquiera podría meter turnos en otra sucursal.
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const sucursal = sucursalPorCodigo(String(b.codigo ?? ""));
  if (!sucursal) {
    return NextResponse.json({ ok: false, error: "Ese código no existe." }, { status: 404 });
  }

  const nombre = String(b.nombre ?? "").trim();
  const telefono = String(b.telefono ?? "").replace(/[^\d+]/g, "");
  if (nombre.length < 3) {
    return NextResponse.json({ ok: false, error: "Escribí tu nombre completo." }, { status: 400 });
  }
  if (telefono.replace(/\D/g, "").length < 8) {
    return NextResponse.json({ ok: false, error: "El teléfono no está completo." }, { status: 400 });
  }

  // Solo ids del catálogo DE ESTA UNIDAD: en la entrada de imagenología no se
  // toma una muestra de sangre, y dejar pasar el id equivocado pondría a
  // alguien en la fila por algo que ahí nadie le va a hacer.
  const tipo = tipoDeOrdenDe(sucursal.tipo);
  const examenes = [...new Set((b.examenes as string[]) ?? [])].filter((e) => esDe(tipo, e));
  if (examenes.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Marcá al menos uno de los que se hacen acá." },
      { status: 400 },
    );
  }

  const turno = await crearTurno({
    sucursalId: sucursal.id,
    nombre,
    telefono,
    correo: String(b.correo ?? "").trim(),
    examenes,
  });

  return NextResponse.json({
    ok: true,
    turnoId: turno.id,
    numero: turno.numero,
    delante: await cuantosDelante(turno),
  });
}
