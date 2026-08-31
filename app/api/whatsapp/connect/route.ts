import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import {
  borrarConexionWa,
  conexionesWaDe,
  guardarConexionWa,
} from "@/lib/wa-conexiones-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Conectar el número de WhatsApp de un cliente.
//
// El navegador abre el diálogo de Meta para WhatsApp (Embedded Signup). Al
// terminar, Meta le da al navegador dos cosas por caminos distintos: un
// `code` de un solo uso (en la respuesta del login) y los ids de la cuenta y
// del número (en un mensaje de ventana). El navegador nos manda las dos y acá
// se hace el resto, que exige el secreto de la app y por eso no puede pasar
// en el navegador:
//
//   1. cambiar el code por un token del negocio del cliente;
//   2. leer el número tal como lo ve la gente y el nombre verificado;
//   3. suscribir la cuenta a nuestra app, que es lo que hace que los mensajes
//      empiecen a llegar al webhook. Sin este paso el token es válido y no
//      llega nada, que es justo el caso difícil de detectar;
//   4. registrar el número en la Cloud API con un PIN. Meta lo exige para
//      poder mandar; el PIN se guarda para volver a registrarlo si hace falta.
//
// GET lista los números del cliente (sin tokens). DELETE quita uno.

const VERSION = process.env.WHATSAPP_GRAPH_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;

interface RespuestaGraph {
  [k: string]: unknown;
  error?: { message?: string; code?: number };
}

async function graph(url: string, init?: RequestInit): Promise<RespuestaGraph> {
  try {
    const r = await fetch(url, { cache: "no-store", ...init });
    return (await r.json().catch(() => ({}))) as RespuestaGraph;
  } catch (e) {
    return { error: { message: e instanceof Error ? e.message : "falló la red" } };
  }
}

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  const cx = await conexionesWaDe(tenant);
  return NextResponse.json({
    ok: true,
    numeros: cx.map((c) => ({
      phoneNumberId: c.phoneNumberId,
      wabaId: c.wabaId,
      numero: c.displayPhone,
      nombre: c.verifiedName,
      conectado: c.connectedAt ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  const appId = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!appId || !secret) {
    return NextResponse.json({ ok: false, error: "Falta la configuración de la app de Meta." }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    code?: string;
    wabaId?: string;
    phoneNumberId?: string;
  };
  const code = body.code?.trim();
  const wabaId = body.wabaId?.trim();
  const phoneNumberId = body.phoneNumberId?.trim();
  if (!code || !wabaId || !phoneNumberId) {
    return NextResponse.json({ ok: false, error: "Meta no devolvió los datos del número." }, { status: 400 });
  }

  // 1. El code por un token del negocio.
  const t = await graph(
    `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(secret)}&code=${encodeURIComponent(code)}`,
  );
  const token = typeof t.access_token === "string" ? t.access_token : null;
  if (!token) {
    console.error("[wa-connect] cambio de code falló:", t.error?.message);
    return NextResponse.json(
      { ok: false, error: "Meta no aceptó la autorización. Volvé a intentar." },
      { status: 502 },
    );
  }

  // 2. Cómo se llama y qué número es.
  const info = await graph(
    `${GRAPH}/${phoneNumberId}?fields=display_phone_number,verified_name,code_verification_status&access_token=${encodeURIComponent(token)}`,
  );
  const displayPhone = typeof info.display_phone_number === "string" ? info.display_phone_number : null;
  const verifiedName = typeof info.verified_name === "string" ? info.verified_name : null;

  // 3. Que los mensajes de esta cuenta lleguen a nuestro webhook.
  const sub = await graph(`${GRAPH}/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const suscrita = sub.success === true;
  if (!suscrita) console.error("[wa-connect] subscribed_apps:", sub.error?.message);

  // 4. Registrar el número para poder mandar. El PIN es nuestro y se guarda.
  const pin = String(Math.floor(100000 + Math.random() * 900000));
  const reg = await graph(`${GRAPH}/${phoneNumberId}/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  });
  // "Ya registrado" no es un error para nosotros: el número ya podía mandar.
  const registrado = reg.success === true || /already|ya est/i.test(reg.error?.message ?? "");
  if (!registrado) console.error("[wa-connect] register:", reg.error?.message);

  const donde = await guardarConexionWa({
    tenant,
    wabaId,
    phoneNumberId,
    displayPhone,
    verifiedName,
    accessToken: token,
    pin: reg.success === true ? pin : null,
  });

  return NextResponse.json({
    ok: true,
    numero: displayPhone,
    nombre: verifiedName,
    suscrita,
    registrado,
    donde,
  });
}

export async function DELETE(req: Request) {
  const tenant = tenantFromRequest(req);
  const body = (await req.json().catch(() => ({}))) as { phoneNumberId?: string };
  if (!body.phoneNumberId) return NextResponse.json({ ok: false }, { status: 400 });
  await borrarConexionWa(tenant, body.phoneNumberId);
  return NextResponse.json({ ok: true });
}
