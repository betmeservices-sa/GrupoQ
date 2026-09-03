import { NextResponse } from "next/server";
import {
  actualizarScriptVapi,
  fetchVapiAgentes,
  hayLlaveVapi,
  lanzarLlamadaVapi,
} from "@/lib/vapi";
import { destinoRiesgoso, normalizarDestinoSV } from "@/lib/phone";
import { tenantFromRequest } from "@/lib/tenants/server";
import { assistantIdDeTenant, assistantIdsDeTenant, esAgencia, esDelTenant, veModuloVoz } from "@/lib/tenants/voz";
import { upsertContacto } from "@/lib/contacts-store";
import { normalizarTelefono } from "@/lib/memoria-llamadas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lista los agentes con su numero asignado.
// La agencia recibe la cuenta completa, con el script. Un cliente recibe SOLO su
// agente y sin script: el prompt es propiedad de la agencia, y recortarlo aca
// (no en la pantalla) es lo unico que lo protege de verdad.
export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (!veModuloVoz(tenant)) {
    return NextResponse.json({ error: "Este módulo no está habilitado." }, { status: 403 });
  }

  try {
    const todos = await fetchVapiAgentes();
    const mios = assistantIdsDeTenant(tenant);
    const agentes = esAgencia(tenant)
      ? todos
      : todos.filter((a) => mios.includes(a.id)).map((a) => ({ ...a, script: "" }));
    return NextResponse.json({
      source: hayLlaveVapi() ? "vapi" : "demo",
      agentes,
      sincronizadaEn: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ source: "vapi", agentes: [], error: msg }, { status: 502 });
  }
}

// Guarda el script (system prompt) de un agente en Vapi.
// Body: { assistantId, script }
export async function PATCH(req: Request) {
  // Editar el prompt es trabajo de la agencia. Un cliente ni siquiera lo recibe.
  if (!esAgencia(tenantFromRequest(req))) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 403 });
  }

  let body: { assistantId?: string; script?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  const assistantId = body.assistantId?.trim();
  if (!assistantId) {
    return NextResponse.json({ ok: false, error: "Falta 'assistantId'" }, { status: 400 });
  }

  // Un script vacio deja al agente sin instrucciones y no es algo que alguien
  // quiera de verdad: se rechaza en vez de dejarlo pasar.
  const script = body.script;
  if (typeof script !== "string" || script.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: "El script no puede quedar vacío." },
      { status: 400 },
    );
  }

  if (!hayLlaveVapi()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Estás en modo demostración (falta VAPI_PRIVATE_KEY). No se puede guardar.",
      },
      { status: 409 },
    );
  }

  try {
    const { script: guardado } = await actualizarScriptVapi(assistantId, script);
    return NextResponse.json({ ok: true, script: guardado });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}

// Dispara una llamada saliente real.
// Body: { assistantId, phoneNumberId, numero }
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (!veModuloVoz(tenant)) {
    return NextResponse.json({ ok: false, error: "Este módulo no está habilitado." }, { status: 403 });
  }

  let body: {
    assistantId?: string;
    phoneNumberId?: string;
    numero?: string;
    nombre?: string;
    fechaPago?: string;
    monto?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  // El agente NO se toma del cuerpo cuando llama un cliente: se impone el suyo.
  // Asi nadie puede marcar (ni facturar minutos) con el agente de otro.
  // Con varios agentes por cliente, el del cuerpo SI se respeta, pero solo si
  // es suyo. Si manda el de otro cliente (o ninguno), cae en su principal.
  const pedido = body.assistantId?.trim();
  const assistantId = esAgencia(tenant)
    ? pedido
    : esDelTenant(pedido, tenant)
      ? pedido
      : assistantIdDeTenant(tenant);
  let phoneNumberId = body.phoneNumberId?.trim();

  if (!esAgencia(tenant) && assistantId) {
    // La linea desde la que se marca tambien tiene que ser del agente del
    // cliente; si no lo es, se usa la suya en vez de fallar.
    const suyos = (await fetchVapiAgentes()).find((a) => a.id === assistantId)?.numeros ?? [];
    if (!phoneNumberId || !suyos.some((n) => n.id === phoneNumberId)) {
      phoneNumberId = suyos[0]?.id;
    }
  }

  if (!assistantId || !phoneNumberId) {
    return NextResponse.json(
      { ok: false, error: "Faltan 'assistantId' o 'phoneNumberId'" },
      { status: 400 },
    );
  }

  const numero = normalizarDestinoSV(body.numero ?? "");
  if (!numero) {
    return NextResponse.json(
      { ok: false, error: "Número inválido. Usá 8 dígitos de El Salvador (ej. 7539 1721)." },
      { status: 400 },
    );
  }

  if (!hayLlaveVapi()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Estás en modo demostración (falta VAPI_PRIVATE_KEY). No se puede lanzar una llamada real.",
      },
      { status: 409 },
    );
  }

  try {
    // Las tres viajan SIEMPRE, aunque vengan vacias. Si una {{variable}} del
    // guion no recibe valor, Vapi la deja escrita tal cual y el agente termina
    // diciendo "hablo con llave llave nombre" en voz alta. Con el relleno, el
    // guion tiene una rama para hablar en general.
    const variables = {
      nombre: body.nombre?.trim() || "no disponible",
      fecha_pago: body.fechaPago?.trim() || "no disponible",
      monto: body.monto?.trim() || "no disponible",
    };
    const llamada = await lanzarLlamadaVapi({ assistantId, phoneNumberId, numero, variables });

    // La ficha se guarda al MARCAR, no al terminar. Cuando nosotros llamamos ya
    // sabemos a quién y a qué número, así que esperar al final solo agrega una
    // forma de perderlo: si no contestan, si se corta, o si el webhook falla, el
    // intento igual tiene que quedar registrado. Al cerrar, el webhook vuelve
    // sobre la misma ficha y le agrega qué pasó.
    //
    // Va con la misma normalización que usa el webhook (8 dígitos) para no
    // terminar con dos fichas de la misma persona.
    if (!esAgencia(tenant)) {
      const partes = (body.nombre ?? "").trim().split(/\s+/).filter(Boolean);
      try {
        await upsertContacto({
          from: normalizarTelefono(numero),
          tenant,
          ...(partes.length > 0
            ? { nombre: partes[0], apellido: partes.slice(1).join(" ") }
            : {}),
        });
      } catch (err) {
        // Que no se guarde la ficha no puede tumbar una llamada que ya salió.
        console.error("[agentes] no se pudo guardar la ficha al marcar:", err);
      }
    }
    return NextResponse.json({
      ok: true,
      id: llamada.id,
      status: llamada.status,
      numero,
      // El rango 6 no termina por el trunk: la llamada se crea igual, pero
      // avisamos para que nadie lo lea como "el agente falló".
      aviso: destinoRiesgoso(numero)
        ? "El destino es del rango 6, que hoy no termina por el trunk (SIP 480). Es muy probable que no timbre."
        : undefined,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
