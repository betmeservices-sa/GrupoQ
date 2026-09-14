import { NextResponse } from "next/server";
import { abrirTurno, cerrarTurno, sucursalPorId, turnoPorId } from "@/lib/consultorio/almacen";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mover el récord de alguien. Solo desde la consola del laboratorio.
//
// Tres acciones y ninguna más: abrir el récord (arranca el cronómetro),
// continuar (queda pendiente lo que falta) y finalizar (se cierra la visita).
// Las dos últimas paran el cronómetro.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (tenantFromRequest(req) !== "consultorio") {
    return NextResponse.json({ ok: false, error: "No existe." }, { status: 404 });
  }
  const { accion, hechos, monto } = (await req.json().catch(() => ({}))) as {
    accion?: string;
    hechos?: string[];
    monto?: number | string | null;
  };
  const { id } = await params;

  const previo = await turnoPorId(id);
  // Tiene que ser de una unidad de la clínica. Cuál, lo dice el propio turno:
  // el mostrador que lo abre ya sabe en qué departamento está parado.
  if (!previo || !sucursalPorId(previo.sucursalId)) {
    return NextResponse.json({ ok: false, error: "Ese turno no existe." }, { status: 404 });
  }

  if (accion === "abrir") {
    return NextResponse.json({ ok: true, turno: await abrirTurno(id) });
  }

  if (accion === "continuar" || accion === "finalizar") {
    const marcados = Array.isArray(hechos) ? hechos.map(String) : [];
    const cobrado = monto === null || monto === undefined || monto === "" ? null : Number(monto);
    if (cobrado !== null && (!Number.isFinite(cobrado) || cobrado < 0)) {
      return NextResponse.json({ ok: false, error: "Ese monto no es un número." }, { status: 400 });
    }
    // Sin monto no se cierra la visita: el paciente paga acá, y una visita
    // finalizada sin cobro es un descuadre que caja descubre al final del día.
    if (accion === "finalizar" && (cobrado === null || cobrado <= 0)) {
      return NextResponse.json(
        { ok: false, error: "Escribí el monto facturado antes de finalizar." },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      turno: await cerrarTurno(id, marcados, accion === "finalizar", cobrado),
    });
  }

  return NextResponse.json({ ok: false, error: "Acción desconocida." }, { status: 400 });
}
