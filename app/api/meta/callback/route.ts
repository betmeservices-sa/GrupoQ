import { NextResponse } from "next/server";
import {
  GRAPH,
  META_APP_ID,
  hayCredencialesMeta,
  redirectUri,
  validarState,
} from "@/lib/meta-oauth";
import { guardarConexiones } from "@/lib/meta-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/meta/callback: LA URL fija registrada en Meta (una sola para todos
// los clientes). Valida el state (tenant + anti-CSRF), intercambia el code por
// un token de usuario de larga duración (~60 días) y lista las páginas
// autorizadas con sus page tokens (que no expiran).
//
// Registrar en Meta: Inicio de sesión con Facebook para empresas >
// Configuración > URI de redireccionamiento de OAuth válidos.

interface PaginaMeta {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const volver = (params: string) => {
    const res = NextResponse.redirect(new URL(`/settings?${params}`, req.url));
    // La cookie de state es de un solo uso.
    res.cookies.set("meta_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  };

  // 1. Validar state: firma correcta Y coincidencia con la cookie del inicio.
  const v = validarState(state);
  const cookieState = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)meta_oauth_state=([^;]+)/)?.[1];
  if (!v.ok || !cookieState || decodeURIComponent(cookieState) !== state) {
    return volver("meta=error&motivo=state");
  }

  // 2. El usuario canceló o Meta devolvió error.
  if (url.searchParams.get("error") || !code) {
    return volver("meta=error&motivo=cancelado");
  }

  // 3. Seam FAKE/REAL: sin app secret, el flujo se simula (modo demo).
  if (!hayCredencialesMeta()) {
    return volver("meta=demo");
  }

  const redirect = redirectUri(req.url);
  const secret = process.env.META_APP_SECRET!;

  try {
    // 4. code → token de usuario corto (redirect_uri debe coincidir EXACTO).
    const cortoRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: META_APP_ID,
          client_secret: secret,
          redirect_uri: redirect,
          code,
        }),
    );
    const corto = await cortoRes.json();
    if (!cortoRes.ok || !corto.access_token) {
      console.error("[meta-oauth] intercambio de code falló:", corto);
      return volver("meta=error&motivo=token");
    }

    // 5. token corto → token de larga duración (~60 días).
    const largoRes = await fetch(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: META_APP_ID,
          client_secret: secret,
          fb_exchange_token: corto.access_token,
        }),
    );
    const largo = await largoRes.json();
    const userToken: string = largo.access_token ?? corto.access_token;

    // 6. Páginas autorizadas + su cuenta de IG. Los page tokens no expiran:
    // son los que usa la bandeja para Messenger/IG del cliente.
    const pagesRes = await fetch(
      `${GRAPH}/me/accounts?` +
        new URLSearchParams({
          fields: "id,name,access_token,instagram_business_account",
          access_token: userToken,
        }),
    );
    const pages = await pagesRes.json();
    let paginas: PaginaMeta[] = pages.data ?? [];

    // Plan B (acceso vía Business Manager): cuando el usuario administra las
    // páginas a través de un portafolio comercial y no con rol directo,
    // /me/accounts puede venir vacío aunque el permiso esté otorgado. Los IDs
    // exactos que el usuario autorizó viajan en los granular_scopes del token;
    // con ellos se consulta cada página directo.
    let idsAutorizados: string[] = [];
    if (paginas.length === 0) {
      const dbgRes = await fetch(
        `${GRAPH}/debug_token?` +
          new URLSearchParams({
            input_token: userToken,
            access_token: `${META_APP_ID}|${secret}`,
          }),
      );
      const dbg = await dbgRes.json();
      const gran = (dbg.data?.granular_scopes ?? []) as Array<{
        scope: string;
        target_ids?: string[];
      }>;
      idsAutorizados = gran.find((g) => g.scope === "pages_show_list")?.target_ids ?? [];
      const porId = await Promise.all(
        idsAutorizados.map(async (id) => {
          const r = await fetch(
            `${GRAPH}/${id}?` +
              new URLSearchParams({
                fields: "id,name,access_token,instagram_business_account",
                access_token: userToken,
              }),
          );
          const j = await r.json();
          return j.error ? null : (j as PaginaMeta);
        }),
      );
      paginas = porId.filter((p): p is PaginaMeta => p !== null);
    }

    // Diagnóstico: qué permisos otorgó realmente Meta en esta autorización.
    // Si paginas=0, casi siempre es que el usuario no seleccionó ninguna página
    // en el diálogo (Meta cachea esa selección entre intentos).
    const permsRes = await fetch(
      `${GRAPH}/me/permissions?access_token=${encodeURIComponent(userToken)}`,
    );
    const perms = await permsRes.json();
    const otorgados: string[] = (perms.data ?? [])
      .filter((p: { permission: string; status: string }) => p.status === "granted")
      .map((p: { permission: string }) => p.permission);

    // Persistencia por tenant: Supabase (tabla meta_connections) o memoria en
    // dev. Con esto la bandeja y las stats enrutan por page id → tenant, igual
    // que WhatsApp enruta por phone_number_id.
    const guardado = await guardarConexiones(
      v.tenant,
      paginas.map((p) => ({
        tenant: v.tenant,
        pageId: p.id,
        pageName: p.name,
        pageToken: p.access_token,
        igId: p.instagram_business_account?.id ?? null,
        userToken,
      })),
    );

    // 7. Suscribe la app a los eventos de mensajes de cada página (webhook de
    // Messenger e Instagram). Sin esto Meta NO entrega los mensajes entrantes
    // a /api/webhooks/meta. Si falla, se registra y el redirect sigue (se
    // puede reintentar reconectando).
    await Promise.all(
      paginas.map(async (p) => {
        try {
          const r = await fetch(`${GRAPH}/${p.id}/subscribed_apps`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              subscribed_fields: "messages,messaging_postbacks",
              access_token: p.access_token,
            }),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok || j.error) {
            console.error(`[meta-oauth] subscribed_apps falló para ${p.id}:`, j.error ?? j);
          }
        } catch (e) {
          console.error(`[meta-oauth] subscribed_apps error de red para ${p.id}:`, e);
        }
      }),
    );

    console.log(
      `[meta-oauth] tenant=${v.tenant} conectó ${paginas.length} página(s):`,
      paginas.map((p) => ({
        id: p.id,
        name: p.name,
        ig: p.instagram_business_account?.id ?? null,
      })),
      "permisos otorgados:",
      otorgados,
      "ids granulares:",
      idsAutorizados,
    );

    const extra = new URLSearchParams({
      meta: "conectado",
      paginas: String(paginas.length),
      permisos: String(otorgados.length),
      // Lista corta de permisos otorgados, para diagnosticar desde el banner
      // sin necesidad de leer los logs de Vercel.
      plist: otorgados.join(","),
    });
    if (idsAutorizados.length) extra.set("gids", String(idsAutorizados.length));
    extra.set("guardado", guardado);
    if (paginas.length) {
      extra.set("nombres", paginas.map((p) => p.name).slice(0, 5).join(", "));
    }
    if (pages.error) extra.set("perror", String(pages.error.code ?? pages.error.message ?? "err"));
    return volver(extra.toString());
  } catch (e) {
    console.error("[meta-oauth] error de red:", e);
    return volver("meta=error&motivo=red");
  }
}
