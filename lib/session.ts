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

/**
 * Crea el valor de la cookie: `<tenant>.<expiracionUnix>.<firma>`.
 * Devuelve null si no hay secreto configurado (fail-closed): el login debe
 * responder error en vez de emitir una sesion insegura.
 */
export async function crearSesion(
  tenant: TenantId,
): Promise<{ valor: string; maxAge: number } | null> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEG;
  const payload = `${tenant}.${exp}`;
  const sig = await firmar(payload);
  if (!sig) return null;
  return { valor: `${payload}.${sig}`, maxAge: MAX_AGE_SEG };
}

/** Devuelve el tenant si la cookie es valida y no expiro; null si no. */
export async function verificarSesion(valor: string | undefined | null): Promise<TenantId | null> {
  if (!valor) return null;
  const partes = valor.split(".");
  if (partes.length !== 3) return null;
  const [tenant, expStr, sig] = partes;

  if (!isTenantId(tenant)) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null;

  const esperada = await firmar(`${tenant}.${expStr}`);
  // Sin secreto (fail-closed) no hay firma con que comparar: nadie valida.
  if (!esperada) return null;
  if (!igualesEnTiempoConstante(sig, esperada)) return null;

  return tenant;
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
