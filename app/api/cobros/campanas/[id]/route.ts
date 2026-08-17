import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import {
  CONCURRENCIA_MAX,
  duracionHumana,
  enVentana,
  estimarMinutos,
  planificarTanda,
  progresoDe,
} from "@/lib/cobros-campanas";
import {
  buscarCampana,
  guardarCampana,
  promesasDeCampana,
  resumirCampana,
} from "@/lib/cobros-store";
import type { Campana, EstadoCampana, EstadoItem } from "@/lib/cobros-tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Igual que la cartera: con 10,000 items, mandarlos todos tumba la pestaña.
const POR_PAGINA = 100;
const MAX_POR_PAGINA = 300;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (tenantFromRequest(req) !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  const { id } = await params;
  const campana = buscarCampana(id);
  if (!campana) {
    return NextResponse.json({ ok: false, error: "Esa campaña ya no existe." }, { status: 404 });
  }

  const url = new URL(req.url);
  const filtro = url.searchParams.get("estado") as EstadoItem | null;
  const limite = Math.min(Number(url.searchParams.get("limite")) || POR_PAGINA, MAX_POR_PAGINA);
  const desde = Math.max(0, Number(url.searchParams.get("desde")) || 0);

  // Lo que ya pasó primero: en una campaña corriendo, lo que el usuario mira
  // es el resultado de las últimas llamadas, no la cola de espera.
  const orden: Record<EstadoItem, number> = {
    en_curso: 0,
    marcando: 1,
    terminada: 2,
    fallida: 3,
    reprogramada: 4,
    pendiente: 5,
    omitida: 6,
  };
  const items = [...campana.items]
    .filter((i) => !filtro || i.estado === filtro)
    .sort((a, b) => orden[a.estado] - orden[b.estado] || b.actualizado.localeCompare(a.actualizado));

  const progreso = progresoDe(campana, promesasDeCampana(campana));
  const minutos = estimarMinutos(progreso.pendientes, campana.concurrencia);

  return NextResponse.json({
    ok: true,
    campana: resumirCampana(campana, promesasDeCampana(campana)),
    enVentana: enVentana(campana.ventana, new Date()),
    // Por qué no se está marcando ahora mismo, en palabras.
    motivo: planificarTanda(campana, new Date()).motivo ?? null,
    restante: { minutos, humano: duracionHumana(minutos) },
    total: items.length,
    desde,
    items: items.slice(desde, desde + limite),
  });
}

interface Parche {
  estado?: EstadoCampana;
  concurrencia?: number;
}

/** Pausar, reanudar, cancelar, o cambiar el "de N en N" con la campaña viva. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (tenantFromRequest(req) !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  const { id } = await params;
  const campana = buscarCampana(id);
  if (!campana) {
    return NextResponse.json({ ok: false, error: "Esa campaña ya no existe." }, { status: 404 });
  }

  let body: Parche;
  try {
    body = (await req.json()) as Parche;
  } catch {
    return NextResponse.json({ ok: false, error: "No se entendió la petición." }, { status: 400 });
  }

  // Una campaña terminada o cancelada no se revive: se crea otra. Reabrirla
  // dejaría items cerrados conviviendo con items nuevos y el progreso mentiría.
  if (campana.estado === "terminada" || campana.estado === "cancelada") {
    return NextResponse.json(
      { ok: false, error: `La campaña está ${campana.estado} y ya no se puede cambiar.` },
      { status: 409 },
    );
  }

  const siguiente: Campana = { ...campana };

  if (body.concurrencia !== undefined) {
    const n = Math.round(Number(body.concurrencia));
    if (!Number.isFinite(n) || n < 1 || n > CONCURRENCIA_MAX) {
      return NextResponse.json(
        { ok: false, error: `La concurrencia va de 1 a ${CONCURRENCIA_MAX}.` },
        { status: 400 },
      );
    }
    siguiente.concurrencia = n;
  }

  if (body.estado) {
    if (!["borrador", "corriendo", "pausada", "cancelada"].includes(body.estado)) {
      return NextResponse.json({ ok: false, error: "Estado no válido." }, { status: 400 });
    }
    siguiente.estado = body.estado;
    if (body.estado === "corriendo" && !siguiente.iniciada) {
      siguiente.iniciada = new Date().toISOString();
    }
    if (body.estado === "cancelada") {
      siguiente.terminada = new Date().toISOString();
      // Lo que estaba en cola se marca omitido: cancelar no es "pausar para
      // siempre", y una cola de 9,000 pendientes en una campaña muerta lee mal.
      siguiente.items = siguiente.items.map((i) =>
        i.estado === "pendiente" || i.estado === "reprogramada" ? { ...i, estado: "omitida" } : i,
      );
    }
  }

  guardarCampana(siguiente);
  return NextResponse.json({
    ok: true,
    campana: resumirCampana(siguiente, promesasDeCampana(siguiente)),
  });
}
