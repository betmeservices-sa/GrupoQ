import { NextResponse } from "next/server";
import { asignarNumeroVapi, fetchVapiNumeros, hayLlaveVapi } from "@/lib/vapi";
import { tenantFromRequest } from "@/lib/tenants/server";
import { esAgencia, soloDelTenant, veModuloVoz } from "@/lib/tenants/voz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Los numeros de la cuenta con el agente que los atiende. La agencia los ve
 * todos; un cliente solo las lineas de SU agente (las demas son de otros).
 */
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (!veModuloVoz(tenant)) {
    return NextResponse.json({ error: "Este módulo no está habilitado." }, { status: 403 });
  }

  try {
    const numeros = soloDelTenant(await fetchVapiNumeros(), tenant);
    return NextResponse.json({
      source: hayLlaveVapi() ? "vapi" : "demo",
      numeros,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ source: "vapi", numeros: [], error: msg }, { status: 502 });
  }
}

/**
 * Asigna o libera un numero.
 * Body: { phoneNumberId, assistantId }  ·  assistantId null = liberar.
 */
export async function PATCH(req: Request) {
  // Mover una linea de un agente a otro afecta a toda la cuenta: solo la agencia.
  if (!esAgencia(tenantFromRequest(req))) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  let body: { phoneNumberId?: string; assistantId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const phoneNumberId = body.phoneNumberId?.trim();
  if (!phoneNumberId) {
    return NextResponse.json({ ok: false, error: "Falta 'phoneNumberId'" }, { status: 400 });
  }

  // Se distingue null (liberar) de undefined (campo ausente, que es un error
  // del cliente). Sin esta distincion, un bug en la UI liberaria numeros.
  if (body.assistantId === undefined) {
    return NextResponse.json(
      { ok: false, error: "Falta 'assistantId' (usá null para liberar el número)" },
      { status: 400 },
    );
  }
  const assistantId = body.assistantId === null ? null : String(body.assistantId).trim() || null;

  if (!hayLlaveVapi()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Estás en modo demostración (falta VAPI_PRIVATE_KEY). No se puede reasignar.",
      },
      { status: 409 },
    );
  }

  try {
    const numero = await asignarNumeroVapi(phoneNumberId, assistantId);
    return NextResponse.json({ ok: true, numero });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
