import { NextResponse } from "next/server";
import { agendarVisita, buscarPropiedad, cancelarVisita, cargarAgenda } from "@/lib/inmobiliaria-store";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La agenda de visitas. Sale de los leads que están en la etapa "visita
// agendada", no de una lista de citas aparte: una sola fuente de verdad.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "inmobiliaria") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  return NextResponse.json({ ok: true, agenda: cargarAgenda() });
}

// Agendar desde la ficha del lead: elige propiedad, día y hora. El lead se mueve
// a la etapa de visita y aparece en el calendario y en el pipeline a la vez.
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "inmobiliaria") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  let body: {
    leadId?: string;
    propiedadId?: string;
    fecha?: string;
    hora?: string;
    duracionMin?: number;
    confirmada?: boolean;
    nota?: string;
    cancelar?: boolean;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "No se entendió la visita." }, { status: 400 });
  }

  const leadId = (body.leadId ?? "").trim();
  if (!leadId) {
    return NextResponse.json({ ok: false, error: "Falta el cliente." }, { status: 400 });
  }

  if (body.cancelar) {
    cancelarVisita(leadId);
    return NextResponse.json({ ok: true, agenda: cargarAgenda() });
  }

  const propiedadId = (body.propiedadId ?? "").trim();
  const propiedad = propiedadId ? buscarPropiedad(propiedadId) : null;
  if (!propiedad) {
    return NextResponse.json({ ok: false, error: "Elegí una propiedad de la cartera." }, { status: 400 });
  }
  if (propiedad.estado === "vendida") {
    return NextResponse.json(
      {
        ok: false,
        error: `${propiedad.codigo} ya no está disponible. Llevar a alguien a verla es quemar la visita.`,
      },
      { status: 409 },
    );
  }

  const fecha = (body.fecha ?? "").trim();
  const hora = (body.hora ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ ok: false, error: "Falta el día de la visita." }, { status: 400 });
  }
  if (!/^\d{2}:\d{2}$/.test(hora)) {
    return NextResponse.json({ ok: false, error: "Falta la hora de la visita." }, { status: 400 });
  }

  const lead = agendarVisita(leadId, {
    propiedadId: propiedad.id,
    fecha,
    hora,
    duracionMin: Number(body.duracionMin) || undefined,
    confirmada: Boolean(body.confirmada),
    nota: (body.nota ?? "").slice(0, 300) || undefined,
  });
  if (!lead) {
    return NextResponse.json({ ok: false, error: "Ese cliente no está en el pipeline." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, agenda: cargarAgenda() });
}
