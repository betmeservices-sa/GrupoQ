// Sesion firmada del lado del SERVIDOR.
//
// Antes la "sesion" era una entrada en localStorage: cualquiera podia entrar
// escribiendo una variable en el navegador, y las rutas de API no validaban
// nada (respondian datos reales a cualquier peticion de internet). Esto lo
// convierte en una frontera de verdad: una cookie HttpOnly firmada con HMAC
// que el servidor verifica en cada request.
//
// Usa Web Crypto (no node:crypto) para que funcione igual en el runtime Edge
// del middleware y en el runtime Node de los route handlers.

import { isTenantId } from "./tenants";
import type { TenantId } from "./tenants/types";
import type { RoleId } from "./data/types";

export const SESSION_COOKIE = "ccg_sesion";

// Duracion de la sesion. Corta a proposito: es un panel con datos de clientes.
const MAX_AGE_SEG = 60 * 60 * 12; // 12 horas

// Devuelve el secreto, o null si no hay uno valido.
// FALLA CERRADA en produccion: sin SESSION_SECRET NO caemos a un default, porque
// cualquier default estaria en el repo (publico) y volveria las sesiones
// falsificables. En su lugar devolvemos null y todo el sistema deja de
// autenticar: nadie entra, pero nadie falsifica. El login se rompe visiblemente
// hasta configurar la variable, que es el modo de fallo seguro.
function secreto(): string | null {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === "production") {
    console.error(
      "[session] SESSION_SECRET no configurado. Login DESACTIVADO (fail-closed) hasta ponerlo.",
    );
    return null;
  }
  // Solo en dev local usamos un valor fijo para poder trabajar.
  return "dev-secret-solo-local-nunca-produccion";
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Devuelve la firma, o null si no hay secreto (fail-closed).
async function firmar(payload: string): Promise<string | null> {
  const sec = secreto();
  if (!sec) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sec),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return b64url(sig);
}

// Comparacion en tiempo constante: evita filtrar la firma byte a byte.
function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export interface Sesion {
  tenant: TenantId;
  rol: RoleId;
  /** true = el rol viene de una cuenta de persona y no se puede cambiar. */
  fijo: boolean;
  /** Quien entro. Vacio en los logins de demo, que no son de nadie. */
  usuario?: string;
}

/**
 * Crea el valor de la cookie: `<tenant>.<rol>.<fijo>.<expiracionUnix>.<firma>`.
 *
 * El rol va DENTRO de la firma a proposito. Antes vivia en el navegador, en un
 * localStorage que cualquiera edita, asi que no protegia nada: era un "ver
 * como" para enseñar el demo. Con una cuenta de una persona real eso no
 * alcanza; el servidor tiene que poder decir que no.
 *
 * Devuelve null si no hay secreto configurado (fail-closed): el login debe
 * responder error en vez de emitir una sesion insegura.
 */
export async function crearSesion(
  tenant: TenantId,
  rol: RoleId = "gerente_marketing",
  fijo = false,
  usuario = "",
): Promise<{ valor: string; maxAge: number } | null> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEG;
  // El usuario va en base64url: puede traer @ y puntos, y el punto es el
  // separador de la cookie. Sin esto, un correo parte la cookie en pedazos.
  const u = usuario ? Buffer.from(usuario, "utf8").toString("base64url") : "-";
  const payload = `${tenant}.${rol}.${fijo ? "1" : "0"}.${u}.${exp}`;
  const sig = await firmar(payload);
  if (!sig) return null;
  return { valor: `${payload}.${sig}`, maxAge: MAX_AGE_SEG };
}

/** Devuelve la sesion si la cookie es valida y no expiro; null si no. */
export async function leerSesion(valor: string | undefined | null): Promise<Sesion | null> {
  if (!valor) return null;
  const partes = valor.split(".");

  // Cookies viejas (tenant.exp.firma) siguen valiendo hasta que expiren, para
  // no echar a nadie de su sesion al desplegar. Entran con acceso total, que es
  // lo que tenian antes de este cambio.
  if (partes.length === 3) {
    const [tenant, expStr, sig] = partes;
    if (!isTenantId(tenant)) return null;
    if (!vigente(expStr)) return null;
    const esperada = await firmar(`${tenant}.${expStr}`);
    if (!esperada || !igualesEnTiempoConstante(sig, esperada)) return null;
    return { tenant, rol: "gerente_marketing", fijo: false };
  }

  if (partes.length !== 6) return null;
  const [tenant, rol, fijoStr, u, expStr, sig] = partes;
  if (!isTenantId(tenant)) return null;
  if (!vigente(expStr)) return null;

  const esperada = await firmar(`${tenant}.${rol}.${fijoStr}.${u}.${expStr}`);
  // Sin secreto (fail-closed) no hay firma con que comparar: nadie valida.
  if (!esperada) return null;
  if (!igualesEnTiempoConstante(sig, esperada)) return null;

  let usuario: string | undefined;
  if (u && u !== "-") {
    try {
      usuario = Buffer.from(u, "base64url").toString("utf8");
    } catch {
      return null;
    }
  }

  return { tenant, rol: rol as RoleId, fijo: fijoStr === "1", usuario };
}

function vigente(expStr: string): boolean {
  const exp = Number(expStr);
  return Number.isFinite(exp) && exp * 1000 >= Date.now();
}

/** Solo el tenant. Lo usan los sitios a los que el rol no les importa. */
export async function verificarSesion(valor: string | undefined | null): Promise<TenantId | null> {
  return (await leerSesion(valor))?.tenant ?? null;
}

export function cookieDeSesion(valor: string, maxAge: number): string {
  const seguro = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE}=${valor}; Path=/; HttpOnly;${seguro} SameSite=Lax; Max-Age=${maxAge}`;
}

export function cookieBorrada(): string {
  const seguro = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly;${seguro} SameSite=Lax; Max-Age=0`;
}

export function sesionDeCookieHeader(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}

// ── "Recordar 2FA por 24h" ──
// Tras verificar el código del segundo factor, se emite esta cookie firmada.
// Mientras sea válida (24h), el login salta el paso del código para ESE usuario.
// A las 24h expira y se vuelve a pedir el código (NO re-escanear: el secreto del
// usuario es permanente). Va ligada al usuario por la firma, no se puede reusar
// para otro. Sin SESSION_SECRET (fail-closed) no valida.
const REMEMBER_2FA_COOKIE = "ccg_2fa";
const MAX_AGE_2FA_SEG = 60 * 60 * 24; // 24 horas

export async function crear2faRecordado(
  usuario: string,
): Promise<{ valor: string; maxAge: number } | null> {
  const u = usuario.trim().toLowerCase();
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_2FA_SEG;
  const sig = await firmar(`2fa.${u}.${exp}`);
  if (!sig) return null;
  return { valor: `${exp}.${sig}`, maxAge: MAX_AGE_2FA_SEG };
}

export async function verificar2faRecordado(
  valor: string | undefined | null,
  usuario: string,
): Promise<boolean> {
  if (!valor) return false;
  const partes = valor.split(".");
  if (partes.length !== 2) return false;
  const [expStr, sig] = partes;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const u = usuario.trim().toLowerCase();
  const esperada = await firmar(`2fa.${u}.${expStr}`);
  if (!esperada) return false;
  return igualesEnTiempoConstante(sig, esperada);
}

export function cookie2faRecordado(valor: string, maxAge: number): string {
  const seguro = process.env.NODE_ENV === "production" ? " Secure;" : "";
  return `${REMEMBER_2FA_COOKIE}=${valor}; Path=/; HttpOnly;${seguro} SameSite=Lax; Max-Age=${maxAge}`;
}

export function leer2faRecordadoDeCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${REMEMBER_2FA_COOKIE}=([^;]+)`));
  return m ? m[1] : null;
}
