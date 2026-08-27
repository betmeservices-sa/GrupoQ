import { NextResponse } from "next/server";
import { conexionesDe } from "@/lib/meta-store";
import { tenantFromRequest } from "@/lib/tenants/server";
import { accionEnMensaje, type AccionMensaje } from "@/lib/meta-acciones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reaccionar a un mensaje de Messenger o Instagram, marcarlo como visto, o
// avisar que se está escribiendo.
// Body: { canal, pageId, recipientId, accion, mid?, emoji? }.
export async function POST(req: Request) {
  let body: {
    canal?: string;
    pageId?: string;
    recipientId?: string;
    accion?: string;
    mid?: string;
    emoji?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const canal = body.canal;
  const pageId = body.pageId?.trim();
  const recipientId = body.recipientId?.trim();
  if (canal !== "facebook" && canal !== "instagram") {
    return NextResponse.json({ ok: false, error: "Canal inválido" }, { status: 400 });
  }
  if (!pageId || !/^\d+$/.test(pageId) || !recipientId || !/^\d+$/.test(recipientId)) {
    return NextResponse.json({ ok: false, error: "Faltan pageId o recipientId" }, { status: 400 });
  }

  let accion: AccionMensaje;
  const mid = body.mid?.trim() ?? "";
  const emoji = body.emoji?.trim() ?? "";
  switch (body.accion) {
    case "reaccionar":
      if (!mid || !emoji) return NextResponse.json({ ok: false, error: "Faltan mid o emoji" }, { status: 400 });
      accion = { accion: "reaccionar", mid, emoji };
      break;
    case "quitar_reaccion":
      if (!mid) return NextResponse.json({ ok: false, error: "Falta mid" }, { status: 400 });
      accion = { accion: "quitar_reaccion", mid };
      break;
    case "visto":
    case "escribiendo":
      accion = { accion: body.accion };
      break;
    default:
      return NextResponse.json({ ok: false, error: "Acción inválida" }, { status: 400 });
  }

  // La página debe pertenecer al tenant del dashboard.
  const tenant = tenantFromRequest(req);
  const cx = (await conexionesDe(tenant)).find((c) => c.pageId === pageId);
  if (!cx) {
    return NextResponse.json({ ok: false, error: "La página no está conectada a este cliente" }, { status: 404 });
  }

  try {
    const r = await accionEnMensaje(cx, canal, recipientId, accion);
    return NextResponse.json({ ok: true, aplicada: r.aplicada ?? null });
  } catch (e) {
    const motivo = e instanceof Error ? e.message : "No se pudo.";
    // "Visto" y "escribiendo" son cortesía: si Meta los rechaza no es un
    // error para quien atiende. Reaccionar sí se avisa.
    if (accion.accion === "visto" || accion.accion === "escribiendo") {
      return NextResponse.json({ ok: false, error: motivo });
    }
    console.error("[meta-accion]", accion.accion, motivo);
    return NextResponse.json({ ok: false, error: motivo }, { status: 502 });
  }
}
