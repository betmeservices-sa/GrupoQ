// TOTP (2FA por aplicación de autenticador) — verificación + utilidades de
// enrolamiento. SOLO servidor. Usa Web Crypto (crypto.subtle), sin depender de
// node:crypto, para correr en cualquier runtime.
//
// Modelo POR USUARIO: cada usuario tiene su propio secreto (ver lib/totp-store).
// La primera vez que entra se le muestra un QR para enrolar su app; después solo
// se le pide el código de 6 dígitos.

const PASO_SEG = 30; // ventana TOTP estándar (RFC 6238)
const DIGITOS = 6;
const TOLERANCIA = 1; // acepta la ventana anterior/siguiente (desfase de reloj)
const ALFABETO_B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// Interruptor global del 2FA. Sin la variable, el login sigue solo con
// contraseña (compatible hacia atrás). Se enciende con TOTP_2FA=on.
export function dosFactorHabilitado(): boolean {
  const v = (process.env.TOTP_2FA || "").trim().toLowerCase();
  return v === "on" || v === "1" || v === "true" || v === "si";
}

// Genera un secreto Base32 nuevo (160 bits), único por usuario.
export function generarSecreto(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return base32Encode(bytes);
}

// otpauth:// que la app de autenticador agrega (por QR o clave manual).
export function otpauthUri(cuenta: string, secretB32: string): string {
  const emisor = "Centro de Comunicacion";
  const label = `${emisor}:${cuenta}`;
  return (
    `otpauth://totp/${encodeURIComponent(label)}` +
    `?secret=${secretB32}&issuer=${encodeURIComponent(emisor)}` +
    `&algorithm=SHA1&digits=6&period=30`
  );
}

function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let valor = 0;
  let out = "";
  for (const b of buf) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALFABETO_B32[(valor >>> bits) & 31];
    }
  }
  if (bits > 0) out += ALFABETO_B32[(valor << (5 - bits)) & 31];
  return out;
}

function base32Decode(s: string): Uint8Array<ArrayBuffer> | null {
  const limpio = s.replace(/=+$/, "").toUpperCase();
  let bits = 0;
  let valor = 0;
  const out: number[] = [];
  for (const ch of limpio) {
    const idx = ALFABETO_B32.indexOf(ch);
    if (idx === -1) return null;
    valor = (valor << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((valor >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

// HOTP(secreto, contador) -> código de 6 dígitos (HMAC-SHA1 + truncado dinámico).
async function hotp(secreto: Uint8Array<ArrayBuffer>, contador: number): Promise<string> {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint32(0, Math.floor(contador / 2 ** 32));
  view.setUint32(4, contador >>> 0);
  const key = await crypto.subtle.importKey(
    "raw",
    secreto,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, buf));
  const off = sig[sig.length - 1] & 0x0f;
  const bin =
    ((sig[off] & 0x7f) << 24) |
    ((sig[off + 1] & 0xff) << 16) |
    ((sig[off + 2] & 0xff) << 8) |
    (sig[off + 3] & 0xff);
  return (bin % 10 ** DIGITOS).toString().padStart(DIGITOS, "0");
}

function igualesEnTiempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/**
 * Verifica un código de 6 dígitos contra un secreto Base32, con tolerancia de
 * una ventana para el desfase de reloj.
 */
export async function verificarTotp(secretB32: string, token: string): Promise<boolean> {
  const limpio = (token || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(limpio)) return false;
  const secreto = base32Decode(secretB32);
  if (!secreto || secreto.length === 0) return false;
  const contador = Math.floor(Date.now() / 1000 / PASO_SEG);
  for (let d = -TOLERANCIA; d <= TOLERANCIA; d++) {
    if (igualesEnTiempoConstante(await hotp(secreto, contador + d), limpio)) return true;
  }
  return false;
}
