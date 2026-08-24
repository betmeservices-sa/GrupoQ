import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { conexionesDe, guardarConexiones } from "@/lib/meta-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/meta/connections: páginas conectadas del tenant logueado, SIN
// tokens (esto lo consume el navegador; los tokens nunca salen del servidor).
export async function GET(req: Request) {
  const conexiones = await conexionesDe(tenantFromRequest(req));
  return NextResponse.json({
    ok: true,
    conexiones: conexiones.map((c) => ({
      pageId: c.pageId,
      nombre: c.pageName,
      instagram: Boolean(c.igId),
    })),
  });
}

// POST /api/meta/connections: alta MANUAL de una página.
//
// Existe porque el OAuth de Meta no sirve hasta que la app esté aprobada, y los
// clientes no pueden esperar a eso para empezar a recibir mensajes. Mientras
// tanto se pega a mano el token de página que se saca del Explorador de la API
// de Graph, y todo lo demás del sistema funciona igual: el webhook enruta por
// pageId, la bandeja y los comentarios leen la misma conexión.
//
// Cuando la aprobación salga, el OAuth sobrescribe estas conexiones por pageId
// y no hay que borrar nada a mano.
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const pageId = String(body.pageId ?? "").trim();
  const pageToken = String(body.pageToken ?? "").trim();
  if (!pageId || !pageToken) {
    return NextResponse.json({ ok: false, error: "Falta el id de la página o su token." }, { status: 400 });
  }

  const igId = String(body.igId ?? "").trim() || null;
  const pageToken0 = pageToken;

  // Se valida contra Meta ANTES de guardar. Un token vencido o de otra página
  // se guardaría igual y el síntoma sería "no llegan mensajes", que es de lo
  // más caro de diagnosticar.
  let pageName = String(body.pageName ?? "").trim();
  try {
    const r = await fetch(
      `https://graph.facebook.com/v21.0/${pageId}?fields=name&access_token=${encodeURIComponent(pageToken0)}`,
      { cache: "no-store" },
    );
    const j = (await r.json()) as { name?: string; error?: { message?: string } };
    if (j.error) {
      return NextResponse.json({ ok: false, error: `Meta rechazó el token: ${j.error.message ?? ""}` }, { status: 400 });
    }
    if (j.name) pageName = j.name;
  } catch {
    return NextResponse.json({ ok: false, error: "No se pudo confirmar el token con Meta." }, { status: 502 });
  }

  // Suscribir la página al webhook. Sin esto el token es válido pero no llega
  // ni un mensaje, que es justo el caso difícil de detectar.
  let suscrita = false;
  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${pageId}/subscribed_apps`, {
      method: "POST",
      body: new URLSearchParams({
        subscribed_fields: "messages,messaging_postbacks,feed",
        access_token: pageToken0,
      }),
    });
    const j = (await r.json()) as { success?: boolean; error?: { message?: string } };
    suscrita = j.success === true;
    if (j.error) console.error("[meta manual] subscribed_apps:", j.error.message);
  } catch (e) {
    console.error("[meta manual] subscribed_apps error de red:", e);
  }

  const donde = await guardarConexiones(tenant, [
    { tenant, pageId, pageName: pageName || pageId, pageToken: pageToken0, igId, userToken: null },
  ]);

  return NextResponse.json({ ok: true, pageId, pageName, igId, suscrita, donde });
}

