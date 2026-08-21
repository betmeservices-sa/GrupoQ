import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import {
  agregarNota,
  asignarTicket,
  cambiarEstado,
  crearTicket,
  listarTickets,
  ticketsEnMemoria,
  ticketsSinTabla,
} from "@/lib/tickets-store";
import { calcularMetricas, ultimosDias } from "@/lib/tickets-metricas";
import { ordenarCola, type EstadoTicket, type TicketNuevo } from "@/lib/tickets";
import { HORARIO_HOSPITAL } from "@/lib/tickets-sla";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// El tenant sale de la cookie firmada, NUNCA del cuerpo del pedido: si viniera
// del cliente, cualquiera podría leer o cerrar los tickets de otro hospital.

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const dias = Number(new URL(req.url).searchParams.get("dias"));
  try {
    // El orden importa: primero se leen (ahí se descubre si falta la tabla) y
    // recién después se preguntan las banderas.
    const tickets = await listarTickets(tenant);
    const metricas = calcularMetricas(tickets, {
      horario: HORARIO_HOSPITAL,
      periodo: Number.isFinite(dias) && dias > 0 ? ultimosDias(dias) : undefined,
    });
    return NextResponse.json({
      ok: true,
      tickets: ordenarCola(tickets),
      metricas,
      enMemoria: ticketsEnMemoria(),
      sinTabla: ticketsSinTabla(),
    });
  } catch (e) {
    console.error("tickets GET:", e);
    return NextResponse.json({ ok: false, error: "No se pudieron leer los tickets." });
  }
}

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  const body = (await req.json().catch(() => ({}))) as Partial<TicketNuevo>;
  const titulo = (body.titulo ?? "").trim();
  if (!titulo) {
    return NextResponse.json({ ok: false, error: "El ticket necesita un título." }, { status: 400 });
  }
  if (!(body.contactoNombre ?? "").trim()) {
    return NextResponse.json({ ok: false, error: "Falta a nombre de quién es." }, { status: 400 });
  }
  try {
    const ticket = await crearTicket(tenant, {
      titulo,
      detalle: body.detalle ?? "",
      tipo: body.tipo ?? "otro",
      prioridad: body.prioridad,
      origen: body.origen ?? "manual",
      creadoPor: body.creadoPor ?? "Mostrador",
      contactoNombre: body.contactoNombre ?? "",
      contactoTelefono: body.contactoTelefono,
      area: body.area ?? "atencion",
      asignadoA: body.asignadoA,
      conversacionId: body.conversacionId,
    });
    return NextResponse.json({ ok: true, ticket });
  } catch (e) {
    console.error("tickets POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo crear el ticket." });
  }
}

export async function PATCH(req: Request) {
  const tenant = tenantFromRequest(req);
  const body = (await req.json().catch(() => ({}))) as {
    id?: string;
    asignadoA?: string;
    estado?: EstadoTicket;
    nota?: string;
    autor?: string;
  };
  if (!body.id) {
    return NextResponse.json({ ok: false, error: "Falta el id." }, { status: 400 });
  }
  try {
    let ticket = null;
    // Se aplican en este orden a propósito: asignar puede sellar la hora de
    // atención, y el cambio de estado tiene que verla ya puesta.
    if (body.asignadoA !== undefined) ticket = await asignarTicket(tenant, body.id, body.asignadoA);
    if (body.estado) ticket = await cambiarEstado(tenant, body.id, body.estado);
    if (body.nota) ticket = await agregarNota(tenant, body.id, body.autor ?? "Sin nombre", body.nota);
    if (!ticket) {
      return NextResponse.json({ ok: false, error: "Ese ticket no existe." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ticket });
  } catch (e) {
    console.error("tickets PATCH:", e);
    return NextResponse.json({ ok: false, error: "No se pudo actualizar el ticket." });
  }
}
