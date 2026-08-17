import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { assistantIdDeTenant } from "@/lib/tenants/voz";
import { hoyEnSv } from "@/lib/cobros-cartera";
import { buscarDeudor } from "@/lib/cobros-store";
import { destinoRiesgoso } from "@/lib/phone";
import { fetchVapiNumeros, lanzarLlamadaVapi } from "@/lib/vapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Números desde los que se puede marcar. Los lee la ficha del deudor. */
export async function GET(req: Request) {
  if (tenantFromRequest(req) !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }
  const numeros = await fetchVapiNumeros().catch(() => []);
  return NextResponse.json({
    ok: true,
    numeros: numeros.map((n) => ({ id: n.id, numero: n.numero, nombre: n.nombre })),
    disponible: Boolean(process.env.VAPI_PRIVATE_KEY),
  });
}

interface Cuerpo {
  deudorId?: string;
  phoneNumberId?: string;
}

/**
 * Una llamada suelta a un deudor, con el mismo agente y las mismas variables
 * que usa la campaña. Es lo que hace el gestor cuando quiere insistirle a una
 * cuenta puntual sin armar un lote.
 */
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  const assistantId = assistantIdDeTenant(tenant);
  if (!assistantId) {
    return NextResponse.json(
      { ok: false, error: "Este cliente no tiene agente de voz configurado." },
      { status: 400 },
    );
  }

  let body: Cuerpo;
  try {
    body = (await req.json()) as Cuerpo;
  } catch {
    return NextResponse.json({ ok: false, error: "No se entendió la petición." }, { status: 400 });
  }

  const d = body.deudorId ? buscarDeudor(body.deudorId) : null;
  if (!d) {
    return NextResponse.json({ ok: false, error: "Esa cuenta no está en la cartera." }, { status: 404 });
  }
  // Una cuenta marcada como no llamable no se marca ni "solo esta vez": ese
  // atajo es exactamente cómo se llama a alguien que pidió que no lo llamen.
  if (!d.llamable) {
    return NextResponse.json(
      { ok: false, error: "Esta cuenta está marcada como no llamable." },
      { status: 409 },
    );
  }
  if (!body.phoneNumberId) {
    return NextResponse.json({ ok: false, error: "Elegí desde qué número marcar." }, { status: 400 });
  }

  const hoy = hoyEnSv();
  const limite = new Date(Date.parse(`${hoy}T12:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10);

  try {
    const llamada = await lanzarLlamadaVapi({
      assistantId,
      phoneNumberId: body.phoneNumberId,
      numero: d.telefono,
      variables: {
        nombre: d.nombre,
        producto: d.producto,
        cuenta: d.cuenta,
        montoVencido: d.montoVencido.toFixed(2),
        diasMora: String(d.diasMora),
        cuotaMensual: d.cuotaMensual.toFixed(2),
        fechaLimite: limite,
      },
    });
    return NextResponse.json({
      ok: true,
      callId: llamada.id,
      // El rango 6 no termina por el trunk: se avisa antes de que el gestor
      // crea que la llamada se cayó sola.
      aviso: destinoRiesgoso(d.telefono)
        ? "Ese número es del rango 6, que el trunk actual no logra completar."
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "No se pudo marcar." },
      { status: 502 },
    );
  }
}
