import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import {
  actualizarPromo,
  borrarPromo,
  crearPromo,
  listarPromos,
  promosEnMemoria,
  promosSinTabla,
} from "@/lib/promos-store";
import type { PromocionNueva } from "@/lib/promos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Las promociones son POR CLIENTE y el tenant sale de la cookie firmada, nunca
// del cuerpo del pedido: si viniera del cliente, cualquiera podría encender una
// promoción en el hotel de otro.

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  try {
    // El orden importa: primero se leen (ahí se descubre si falta la tabla) y
    // recién después se preguntan las banderas.
    const promos = await listarPromos(tenant);
    return NextResponse.json({
      ok: true,
      promos,
      enMemoria: promosEnMemoria(),
      sinTabla: promosSinTabla(),
    });
  } catch (e) {
    console.error("promos GET:", e);
    return NextResponse.json({ ok: false, error: "No se pudieron leer las promociones." });
  }
}

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  const body = (await req.json().catch(() => ({}))) as Partial<PromocionNueva>;
  const nombre = (body.nombre ?? "").trim();
  if (!nombre) {
    return NextResponse.json({ ok: false, error: "La promoción necesita un nombre." }, { status: 400 });
  }
  try {
    const promo = await crearPromo(tenant, {
      nombre,
      descripcion: body.descripcion ?? "",
      precio: body.precio ?? "",
      restricciones: body.restricciones ?? "",
      desde: body.desde,
      hasta: body.hasta,
      activa: body.activa !== false,
    });
    return NextResponse.json({ ok: true, promo });
  } catch (e) {
    console.error("promos POST:", e);
    return NextResponse.json({ ok: false, error: "No se pudo guardar la promoción." });
  }
}

export async function PATCH(req: Request) {
  const tenant = tenantFromRequest(req);
  const body = (await req.json().catch(() => ({}))) as { id?: string } & Partial<PromocionNueva>;
  if (!body.id) {
    return NextResponse.json({ ok: false, error: "Falta el id." }, { status: 400 });
  }
  const { id, ...cambios } = body;
  try {
    const promo = await actualizarPromo(tenant, id, cambios);
    if (!promo) {
      return NextResponse.json({ ok: false, error: "Esa promoción no existe." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, promo });
  } catch (e) {
    console.error("promos PATCH:", e);
    return NextResponse.json({ ok: false, error: "No se pudo actualizar la promoción." });
  }
}

export async function DELETE(req: Request) {
  const tenant = tenantFromRequest(req);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Falta el id." }, { status: 400 });
  try {
    await borrarPromo(tenant, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("promos DELETE:", e);
    return NextResponse.json({ ok: false, error: "No se pudo borrar la promoción." });
  }
}
