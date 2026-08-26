import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { CAMPOS_WEBHOOK } from "@/lib/meta-oauth";
import { conexionesDe, guardarConexiones } from "@/lib/meta-store";
import type { MetaConnection } from "@/lib/meta-store";

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
      igDirecto: Boolean(c.igToken),
      igUsername: c.igUsername ?? null,
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
const GRAPH = "https://graph.facebook.com/v21.0";

interface PaginaGraph {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: { id?: string };
}

/**
 * Cambia el token de usuario corto por uno largo.
 *
 * Importa más de lo que parece: los tokens de PÁGINA que se sacan de un token
 * de usuario corto vencen en una hora. Los que se sacan de uno largo no vencen.
 * Sin este paso, la conexión funciona en la demo y se cae al rato, que es el
 * peor momento para que se caiga.
 */
async function aTokenLargo(userToken: string): Promise<string> {
  const id = process.env.META_APP_ID;
  const secret = process.env.META_APP_SECRET;
  if (!id || !secret) return userToken;
  try {
    const r = await fetch(
      `${GRAPH}/oauth/access_token?grant_type=fb_exchange_token&client_id=${id}&client_secret=${secret}&fb_exchange_token=${encodeURIComponent(userToken)}`,
      { cache: "no-store" },
    );
    const j = (await r.json()) as { access_token?: string };
    return j.access_token ?? userToken;
  } catch {
    return userToken;
  }
}

async function suscribir(pageId: string, token: string): Promise<boolean> {
  try {
    const r = await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
      method: "POST",
      body: new URLSearchParams({
        subscribed_fields: CAMPOS_WEBHOOK,
        access_token: token,
      }),
    });
    const j = (await r.json()) as { success?: boolean; error?: { message?: string } };
    if (j.error) console.error("[meta] subscribed_apps:", pageId, j.error.message);
    return j.success === true;
  } catch (e) {
    console.error("[meta] subscribed_apps error de red:", pageId, e);
    return false;
  }
}

/**
 * Conecta TODAS las páginas de un token de usuario, de una.
 *
 * Es el camino corto: en vez de que alguien copie id de página, id de Instagram
 * y token por cada sede (nueve datos y nueve formas de equivocarse), se pega un
 * token de usuario y acá se descubren todas con su Instagram ya vinculado.
 */
/** El Instagram de una pagina, preguntado con el token de esa pagina. */
async function instagramDe(pageId: string, pageToken: string): Promise<string | null> {
  try {
    const url = `${GRAPH}/${pageId}?fields=instagram_business_account{id}&access_token=${encodeURIComponent(pageToken)}`;
    const r = await fetch(url, { cache: "no-store" });
    const j = (await r.json()) as { instagram_business_account?: { id?: string } };
    return j.instagram_business_account?.id ?? null;
  } catch {
    // Que falte el Instagram no puede tumbar la conexion de la pagina: sin el
    // igual entran WhatsApp y Messenger.
    return null;
  }
}

async function conectarTodas(tenant: string, userToken: string) {
  const largo = await aTokenLargo(userToken);
  const url = `${GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account&limit=100&access_token=${encodeURIComponent(largo)}`;
  const r = await fetch(url, { cache: "no-store" });
  const j = (await r.json()) as { data?: PaginaGraph[]; error?: { message?: string } };
  if (j.error) throw new Error(j.error.message ?? "Meta rechazó el token.");

  const paginas = (j.data ?? []).filter((p) => p.id && p.access_token);
  if (paginas.length === 0) {
    throw new Error("Ese token no tiene ninguna página. Revisá que incluya el permiso pages_show_list.");
  }

  // El Instagram se vuelve a pedir pagina por pagina cuando no vino en la
  // consulta de arriba. No es paranoia: con la misma pagina y el mismo permiso,
  // Graph a veces devuelve el campo anidado vacio contra el token de usuario y
  // lleno contra el token de la pagina. Sin este rescate, la sede queda
  // conectada pero sorda a los mensajes de Instagram, y no se nota hasta que
  // alguien reclama que le escribio por ahi y nadie le contesto.
  const conexiones: MetaConnection[] = await Promise.all(
    paginas.map(async (p) => ({
      tenant,
      pageId: p.id,
      pageName: p.name ?? p.id,
      pageToken: p.access_token as string,
      igId: p.instagram_business_account?.id ?? (await instagramDe(p.id, p.access_token as string)),
      userToken: largo,
    })),
  );

  const suscritas = await Promise.all(conexiones.map((c) => suscribir(c.pageId, c.pageToken)));
  const donde = await guardarConexiones(tenant, conexiones);

  return {
    donde,
    paginas: conexiones.map((c, i) => ({
      pageId: c.pageId,
      pageName: c.pageName,
      instagram: Boolean(c.igId),
      suscrita: suscritas[i],
    })),
  };
}

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  // Camino corto: un token de usuario y se conectan todas sus páginas.
  const userToken = String(body.userToken ?? "").trim();
  if (userToken) {
    try {
      const r = await conectarTodas(tenant, userToken);
      return NextResponse.json({ ok: true, ...r });
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: e instanceof Error ? e.message : "No se pudo conectar." },
        { status: 400 },
      );
    }
  }

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
        subscribed_fields: CAMPOS_WEBHOOK,
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

