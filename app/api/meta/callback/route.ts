import { NextResponse } from "next/server";
import {
  GRAPH,
  META_APP_ID,
  hayCredencialesMeta,
  redirectUri,
  validarState,
} from "@/lib/meta-oauth";

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
    const paginas: PaginaMeta[] = pages.data ?? [];

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

    // TODO(REAL): persistir por tenant en Supabase (tabla meta_connections):
    // v.tenant, userToken (largo), y por página: page id, name, page token e
    // instagram_business_account.id. Con eso la bandeja enruta webhooks por
    // page id → tenant, igual que WhatsApp enruta por phone_number_id.
    console.log(
      `[meta-oauth] tenant=${v.tenant} conectó ${paginas.length} página(s):`,
      paginas.map((p) => ({
        id: p.id,
        name: p.name,
        ig: p.instagram_business_account?.id ?? null,
      })),
      "permisos otorgados:",
      otorgados,
    );

    return volver(
      `meta=conectado&paginas=${paginas.length}&permisos=${otorgados.length}`,
    );
  } catch (e) {
    console.error("[meta-oauth] error de red:", e);
    return volver("meta=error&motivo=red");
  }
}
