// Instagram con inicio de sesión de Instagram.
//
// POR QUÉ EXISTE
// Sin App Review, los DMs de Instagram de gente sin rol en la app no llegan
// por el camino de Facebook (se comprobó el 2026-08-26: un DM de un tercero a
// Yali no generó aviso; el del admin de la app, sí). Y la API de
// conversaciones de Instagram por la página está cerrada con acceso estándar.
//
// Meta documenta otra puerta: la "API de Instagram con inicio de sesión de
// Instagram". Ahí el acceso estándar cubre las cuentas profesionales que se
// AGREGAN A LA APP en el panel de Meta (como Instagram Testers), y para esas
// cuentas avisa de mensajes de cualquier persona. Son las dos cuentas del
// cliente, no cada cliente suyo.
//
// Lo que cambia con esta puerta:
//   - la cuenta entra con SU usuario de Instagram (no con Facebook),
//   - el token es de la cuenta de IG, dura 60 días y se refresca solo,
//   - las llamadas van a graph.instagram.com con ese token,
//   - los webhooks llegan igual que hoy (object=instagram, entry.id = ig id),
//     pero firmados con el secret de Instagram, no con el de la app.
//
// Config en el panel de Meta: producto Instagram > "Configuración de la API
// con inicio de sesión de Instagram" > Instagram App ID / Secret > URI de
// redirección > webhooks (misma URL y verify token) > Instagram Testers.

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { actualizarTokenIg, type MetaConnection } from "./meta-store";

const VERSION = process.env.IG_GRAPH_VERSION || "v23.0";
export const IG_GRAPH = `https://graph.instagram.com/${VERSION}`;
const IG_AUTORIZAR = "https://www.instagram.com/oauth/authorize";
const IG_TOKEN = "https://api.instagram.com/oauth/access_token";
const IG_TOKEN_LARGO = "https://graph.instagram.com/access_token";
const IG_REFRESCAR = "https://graph.instagram.com/refresh_access_token";

export const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
];

// Todo lo que acepta la suscripción de una cuenta con login de Instagram. Si
// Meta rechaza alguno, el pedido ENTERO se cae (aprendido hoy con la página),
// así que hay un segundo intento con lo mínimo.
const CAMPOS_IG = "messages,comments,messaging_postbacks,messaging_seen,message_reactions,messaging_referral,messaging_handover,standby";
const CAMPOS_IG_MINIMOS = "messages,comments";

// Refrescar cuando falten menos de 7 días: si el panel está cerrado una
// semana entera, igual alcanza a renovarse la próxima vez que se use.
const REFRESCAR_ANTES_MS = 7 * 24 * 60 * 60_000;

function appId(): string {
  return process.env.IG_APP_ID || "";
}
function appSecret(): string {
  return process.env.IG_APP_SECRET || "";
}

/** ¿Está configurado el login de Instagram? Sin esto el botón no se muestra. */
export function hayLoginIg(): boolean {
  return Boolean(appId() && appSecret());
}

export function redirectUriIg(reqUrl?: string): string {
  if (process.env.IG_REDIRECT_URI) return process.env.IG_REDIRECT_URI;
  if (process.env.NODE_ENV === "development" && reqUrl) {
    return new URL("/api/meta/ig/callback", reqUrl).toString();
  }
  return "https://demo.miagentia.com/api/meta/ig/callback";
}

// state = "tenant.nonce.firma", igual que el de Facebook pero con el secret de
// Instagram: así un state del otro flujo no vale acá.
function stateSecret(): string | null {
  return process.env.META_STATE_SECRET || appSecret() || null;
}

export function crearStateIg(tenant: string): string {
  const nonce = randomBytes(12).toString("hex");
  const payload = `${tenant}.${nonce}`;
  const secret = stateSecret();
  const sig = secret ? createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32) : "demo";
  return `${payload}.${sig}`;
}

export function validarStateIg(state: string | null): { ok: true; tenant: string } | { ok: false } {
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

export function urlLoginIg(state: string, redirect: string): string {
  const p = new URLSearchParams({
    client_id: appId(),
    redirect_uri: redirect,
    response_type: "code",
    scope: IG_SCOPES.join(","),
    state,
    // Que entre con la cuenta del negocio aunque el celular tenga otra abierta.
    force_reauth: "true",
  });
  return `${IG_AUTORIZAR}?${p.toString()}`;
}

interface ErrorMeta {
  error?: { message?: string };
  error_message?: string;
  error_type?: string;
}

function mensajeDe(j: ErrorMeta, porDefecto: string): string {
  return j.error?.message ?? j.error_message ?? porDefecto;
}

/** Código de autorización → token corto (1 h) + id de la cuenta. */
export async function intercambiarCodigoIg(
  code: string,
  redirect: string,
): Promise<{ token: string; userId: string; permisos: string }> {
  const cuerpo = new URLSearchParams({
    client_id: appId(),
    client_secret: appSecret(),
    grant_type: "authorization_code",
    redirect_uri: redirect,
    code,
  });
  const r = await fetch(IG_TOKEN, { method: "POST", body: cuerpo });
  const j = (await r.json()) as ErrorMeta & {
    access_token?: string;
    user_id?: string | number;
    permissions?: string;
    // Meta lo documenta envuelto en data[]; en la práctica llega de las dos formas.
    data?: { access_token?: string; user_id?: string | number; permissions?: string }[];
  };
  const d = j.data?.[0] ?? j;
  if (!d.access_token) throw new Error(mensajeDe(j, "Instagram no devolvió el token."));
  return { token: d.access_token, userId: String(d.user_id ?? ""), permisos: d.permissions ?? "" };
}

/** Token corto → token largo (60 días). */
export async function tokenLargoIg(corto: string): Promise<{ token: string; vence: string }> {
  const p = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret(),
    access_token: corto,
  });
  const r = await fetch(`${IG_TOKEN_LARGO}?${p}`, { cache: "no-store" });
  const j = (await r.json()) as ErrorMeta & { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error(mensajeDe(j, "No se pudo alargar el token de Instagram."));
  return { token: j.access_token, vence: venceDesde(j.expires_in) };
}

/** Token largo → otro token largo por 60 días más. */
export async function refrescarTokenIg(token: string): Promise<{ token: string; vence: string }> {
  const p = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token });
  const r = await fetch(`${IG_REFRESCAR}?${p}`, { cache: "no-store" });
  const j = (await r.json()) as ErrorMeta & { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error(mensajeDe(j, "No se pudo refrescar el token de Instagram."));
  return { token: j.access_token, vence: venceDesde(j.expires_in) };
}

export function venceDesde(expiresIn: number | undefined, ahora = Date.now()): string {
  const seg = typeof expiresIn === "number" && expiresIn > 0 ? expiresIn : 60 * 24 * 60 * 60;
  return new Date(ahora + seg * 1000).toISOString();
}

/** ¿Toca refrescar? Sin fecha guardada se asume que sí: refrescar de más no daña. */
export function hayQueRefrescar(venceIso: string | null | undefined, ahora = Date.now()): boolean {
  if (!venceIso) return true;
  const vence = Date.parse(venceIso);
  if (Number.isNaN(vence)) return true;
  return vence - ahora < REFRESCAR_ANTES_MS;
}

/** El id de la cuenta profesional (el que llega en los webhooks) y su usuario. */
export async function perfilIg(token: string): Promise<{ igId: string; username: string | null }> {
  const r = await fetch(`${IG_GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  const j = (await r.json()) as ErrorMeta & {
    user_id?: string | number;
    username?: string;
    data?: { user_id?: string | number; username?: string }[];
  };
  const d = j.data?.[0] ?? j;
  if (!d.user_id) throw new Error(mensajeDe(j, "Instagram no devolvió la cuenta."));
  return { igId: String(d.user_id), username: d.username ?? null };
}

/** Suscribe la cuenta a los webhooks. Devuelve qué campos quedaron. */
export async function suscribirIg(igId: string, token: string): Promise<string | null> {
  for (const campos of [CAMPOS_IG, CAMPOS_IG_MINIMOS]) {
    const p = new URLSearchParams({ subscribed_fields: campos, access_token: token });
    try {
      const r = await fetch(`${IG_GRAPH}/${igId}/subscribed_apps`, { method: "POST", body: p });
      const j = (await r.json()) as ErrorMeta & { success?: boolean };
      if (j.success) return campos;
      console.error("[ig-login] subscribed_apps rechazó", campos, ":", mensajeDe(j, "sin detalle"));
    } catch (e) {
      console.error("[ig-login] subscribed_apps error de red:", e);
    }
  }
  return null;
}

/**
 * El token de Instagram directo listo para usar, refrescado si hace falta.
 * null si la conexión no tiene login de Instagram.
 */
export async function tokenIgVigente(cx: MetaConnection): Promise<string | null> {
  if (!cx.igToken) return null;
  if (!hayQueRefrescar(cx.igTokenVence)) return cx.igToken;
  try {
    const nuevo = await refrescarTokenIg(cx.igToken);
    await actualizarTokenIg(cx, nuevo.token, nuevo.vence);
    return nuevo.token;
  } catch (e) {
    // Se sigue con el que hay: si todavía sirve, sirve; si no, el error real
    // sale en la llamada que venga.
    console.error("[ig-login] no se pudo refrescar el token de", cx.igUsername ?? cx.igId, ":", e);
    return cx.igToken;
  }
}

/**
 * Un id de comentario de Instagram es solo dígitos; los de Facebook llevan el
 * id del post y un guion bajo ("113226271738310_1032971579773971").
 */
export function esComentarioInstagram(comentarioId: string): boolean {
  return /^\d+$/.test(comentarioId);
}

async function llamarIg(url: string, token: string, cuerpo: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(cuerpo),
  });
  const j = (await r.json().catch(() => ({}))) as ErrorMeta & Record<string, unknown>;
  if (!r.ok || j.error) throw new Error(mensajeDe(j, `HTTP ${r.status}`));
  return j;
}

/** DM a una persona desde la cuenta de IG. Devuelve el id del mensaje. */
export async function enviarDmIg(cx: MetaConnection, recipientId: string, texto: string): Promise<string | null> {
  const token = await tokenIgVigente(cx);
  if (!token || !cx.igId) return null;
  const j = await llamarIg(`${IG_GRAPH}/${cx.igId}/messages`, token, {
    recipient: { id: recipientId },
    message: { text: texto },
  });
  return typeof j.message_id === "string" ? j.message_id : null;
}

export async function responderComentarioIg(cx: MetaConnection, comentarioId: string, texto: string): Promise<void> {
  const token = await tokenIgVigente(cx);
  if (!token) throw new Error("Esta cuenta no tiene login de Instagram.");
  await llamarIg(`${IG_GRAPH}/${comentarioId}/replies`, token, { message: texto });
}

export async function ocultarComentarioIg(cx: MetaConnection, comentarioId: string, oculto: boolean): Promise<void> {
  const token = await tokenIgVigente(cx);
  if (!token) throw new Error("Esta cuenta no tiene login de Instagram.");
  await llamarIg(`${IG_GRAPH}/${comentarioId}`, token, { hide: oculto });
}
