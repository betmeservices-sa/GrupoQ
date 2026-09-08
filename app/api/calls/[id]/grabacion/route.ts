import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { esDelTenant, veModuloVoz } from "@/lib/tenants/voz";
import { detalleLlamadaVapi } from "@/lib/vapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La grabación de una llamada.
//
// Existe porque el `recordingUrl` que devuelve Vapi apunta a su bucket PRIVADO
// y responde 400 a cualquiera que lo abra: ese era el link que nunca sonó. Las
// que sí se pueden reproducir son las firmadas (`presignedMonoUrl`), y esas
// CADUCAN a las pocas horas, así que guardarlas en la base sería cambiar un
// link roto por uno que se rompe mañana.
//
// Por eso acá no se guarda nada: se pide la llamada a Vapi en el momento del
// clic y se redirige a la URL firmada de ese momento. El navegador reproduce
// como si fuera un archivo cualquiera.
//
// La frontera de cliente se aplica ACÁ y no en la pantalla: la cuenta de voz
// tiene agentes de varios clientes, y sin esta comprobación bastaría con el id
// de una llamada ajena para escucharla.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = tenantFromRequest(req);
  if (!veModuloVoz(tenant)) {
    return NextResponse.json({ ok: false, error: "Este módulo no está habilitado." }, { status: 403 });
  }

  const { id } = await params;
  let llamada;
  try {
    llamada = await detalleLlamadaVapi(id);
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo consultar la llamada." }, { status: 502 });
  }
  if (!llamada) {
    return NextResponse.json({ ok: false, error: "Esa llamada no existe." }, { status: 404 });
  }
  if (!esDelTenant(llamada.assistantId, tenant)) {
    return NextResponse.json({ ok: false, error: "Esa llamada no es de este cliente." }, { status: 403 });
  }
  if (!llamada.url) {
    return NextResponse.json(
      { ok: false, error: "Esta llamada no dejó grabación." },
      { status: 404 },
    );
  }

  // 302 y no proxy: el audio pesa y no tiene por qué pasar por nuestro
  // servidor. La URL firmada ya limita a quién y por cuánto tiempo sirve.
  return NextResponse.redirect(llamada.url, { status: 302 });
}
