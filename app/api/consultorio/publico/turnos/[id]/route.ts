import { NextResponse } from "next/server";
import { cuantosDelante, sucursalPorId, turnoPorId } from "@/lib/consultorio/almacen";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// En qué va MI turno. Público: lo consulta el propio paciente desde su
// teléfono, con el id que le tocó, y no hay cuenta que pedirle.
//
// Devuelve lo justo para la pantalla de espera. En particular NO devuelve la
// lista de quiénes están delante: el número alcanza para saber cuánto falta, y
// los nombres de los demás no son asunto de quien mira.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const turno = await turnoPorId(id);
  if (!turno) {
    return NextResponse.json({ ok: false, error: "Ese turno no existe." }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    numero: turno.numero,
    // El código con el que lo llaman en el mostrador: el paciente lo enseña en
    // la pantalla de su teléfono y recepción lo escribe para abrir su récord.
    codigo: turno.codigo,
    estado: turno.estado,
    delante: await cuantosDelante(turno),
    // Los que quedaron sin hacerse, para que la pantalla del paciente no diga
    // "listo" cuando en realidad le faltan cuatro.
    faltan: turno.examenes.length - turno.hechos.length,
    sucursal: sucursalPorId(turno.sucursalId)?.nombre ?? "",
    // Lo que se le cobró, cuando ya se facturó.
    factura: turno.factura,
    monto: turno.monto,
  });
}
