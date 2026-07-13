// OAuth de Meta (Facebook Login for Business) para conectar los activos de un
// cliente (página de Facebook + cuenta de Instagram) a su tenant.
//
// Arquitectura: UNA app de Meta y UNA URL de callback sirven a TODOS los
// clientes. El parámetro `state` viaja firmado (HMAC) con el tenant que inició
// la conexión; el callback lo valida y sabe a qué cliente pertenece el token.
// Agregar un cliente nuevo NO requiere tocar la config de Meta.
//
// WhatsApp NO va por este OAuth: Cloud API se conecta con token de sistema
// (ver .env.example, WHATSAPP_*).

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const VERSION = process.env.META_GRAPH_VERSION || "v21.0";
export const GRAPH = `https://graph.facebook.com/${VERSION}`;
const DIALOG = `https://www.facebook.com/${VERSION}/dialog/oauth`;

// App "MiAgentIA" (tipo Negocios) del panel de Meta.
export const META_APP_ID = process.env.META_APP_ID || "1049131010901646";

// Permisos de la bandeja omnicanal: Messenger + DMs/comentarios/publicación de
// IG + posts/comentarios de la página + estadísticas. Todos requieren acceso
// avanzado vía App Review para servir a clientes sin rol en la app.
export const META_SCOPES = [
  "pages_show_list",
  "pages_manage_metadata",
  "pages_read_engagement",
  "pages_messaging",
  "pages_manage_posts",
  "pages_read_user_content",
  "pages_manage_engagement",
  "read_insights",
  "instagram_basic",
  "instagram_manage_messages",
  "instagram_manage_comments",
  "instagram_manage_insights",
  "instagram_content_publish",
];

// URL fija de callback, registrada UNA vez en Meta (Inicio de sesión con
// Facebook para empresas > URI de redireccionamiento de OAuth válidos).
// En desarrollo cae al origin local para poder probar sin tocar producción.
export function redirectUri(reqUrl?: string): string {
  if (process.env.META_REDIRECT_URI) return process.env.META_REDIRECT_URI;
  if (process.env.NODE_ENV === "development" && reqUrl) {
    return new URL("/api/meta/callback", reqUrl).toString();
  }
  return "https://conectar.miagentia.com/api/meta/callback";
}

// Seam FAKE/REAL: sin app secret no se puede intercambiar el code y el flujo
// se simula (igual que el resto del dashboard en modo demo).
export function hayCredencialesMeta(): boolean {
  return Boolean(process.env.META_APP_SECRET);
}

function stateSecret(): string | null {
  return process.env.META_STATE_SECRET || process.env.META_APP_SECRET || null;
}

// state = "tenant.nonce.firma". La firma (HMAC-SHA256 truncado) evita que un
// tercero forje un state con otro tenant; el nonce + cookie evita CSRF.
export function crearState(tenant: string): string {
  const nonce = randomBytes(12).toString("hex");
  const payload = `${tenant}.${nonce}`;
  const secret = stateSecret();
  const sig = secret
    ? createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32)
    : "demo";
  return `${payload}.${sig}`;
}

export function validarState(state: string | null): { ok: true; tenant: string } | { ok: false } {
  if (!state) return { ok: false };
  const parts = state.split(".");
  if (parts.length !== 3) return { ok: false };
  const [tenant, nonce, sig] = parts;
  const secret = stateSecret();
  if (!secret) return sig === "demo" ? { ok: true, tenant } : { ok: false };
  const expected = createHmac("sha256", secret).update(`${tenant}.${nonce}`).digest("hex").slice(0, 32);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
  return { ok: true, tenant };
}

export function urlDialogoOAuth(state: string, redirect: string): string {
  const p = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: redirect,
    state,
    response_type: "code",
    scope: META_SCOPES.join(","),
  });
  return `${DIALOG}?${p.toString()}`;
}
