import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { hoyEnSv, resolverDeudor } from "@/lib/cobros-cartera";
import { analizarLlamada, aplicarAnalisis } from "@/lib/cobros-ia";
import { buscarDeudor, guardarDeudor } from "@/lib/cobros-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Leer un transcript con el modelo tarda más que los 10s de Vercel Hobby por
// defecto. Es la ruta más lenta del módulo y la que no puede cortarse a medias.
export const maxDuration = 60;

interface Cuerpo {
  deudorId?: string;
  // Analizar una llamada que ya está en el historial de la ficha.
  gestionId?: string;
  // O pegar un transcript a mano (así se prueba el flujo sin marcar a nadie).
  transcript?: string;
  duracionSeg?: number;
  endedReason?: string;
}

/**
 * Lee un transcript con Claude y deja la ficha del cliente actualizada.
 *
 * Es el mismo camino que usa el webhook cuando cae una llamada real; acá se
 * expone a mano para que el gestor pueda re-analizar una llamada vieja o para
 * demostrar el flujo completo sin telefonía.
 */
export async function POST(req: Request) {
  if (tenantFromRequest(req) !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "Falta ANTHROPIC_API_KEY: el análisis no está disponible en este entorno." },
      { status: 503 },
    );
  }

  let body: Cuerpo;
  try {
    body = (await req.json()) as Cuerpo;
  } catch {
    return NextResponse.json({ ok: false, error: "No se entendió la petición." }, { status: 400 });
  }

  const deudor = body.deudorId ? buscarDeudor(body.deudorId) : null;
  if (!deudor) {
    return NextResponse.json({ ok: false, error: "Esa cuenta no está en la cartera." }, { status: 404 });
  }

  const gestion = body.gestionId ? deudor.gestiones.find((g) => g.id === body.gestionId) : undefined;
  const transcript = (body.transcript ?? gestion?.transcript ?? "").trim();
  if (!transcript) {
    return NextResponse.json(
      { ok: false, error: "Esa llamada no tiene transcripción que leer." },
      { status: 400 },
    );
  }

  let analisis;
  try {
    analisis = await analizarLlamada({
      deudor,
      transcript,
      duracionSeg: body.duracionSeg ?? gestion?.duracionSeg,
      endedReason: body.endedReason,
    });
  } catch (err) {
    const detalle = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: detalle }, { status: 502 });
  }

  if (!analisis) {
    return NextResponse.json(
      { ok: false, error: "La transcripción es demasiado corta para sacar algo de ella." },
      { status: 400 },
    );
  }

  const actualizado = guardarDeudor(
    aplicarAnalisis(deudor, analisis, {
      ahora: new Date(),
      callId: gestion?.callId,
      campanaId: gestion?.campanaId,
      duracionSeg: body.duracionSeg ?? gestion?.duracionSeg,
      transcript,
      grabacionUrl: gestion?.grabacionUrl,
    }),
  );

  return NextResponse.json({
    ok: true,
    analisis,
    deudor: resolverDeudor(actualizado, hoyEnSv()),
  });
}
