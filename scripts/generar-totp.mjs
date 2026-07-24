// Genera un secreto TOTP para el 2FA por app del login.
//
// Uso:
//   node scripts/generar-totp.mjs            -> secreto GLOBAL (todos los tenants)
//   node scripts/generar-totp.mjs hospital   -> secreto para un tenant puntual
//
// Imprime el secreto Base32, el otpauth:// para escanear/pegar en la app
// (Google Authenticator / Authy), y la línea exacta de variable de entorno que
// hay que poner en Vercel (y en .env.local si querés probar en local).
//
// El secreto NO se guarda en ningún lado por este script: lo pones vos en la
// app de autenticación y en la variable de entorno. Si lo perdés, generás otro.

import { randomBytes } from "node:crypto";

const ALFA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0;
  let valor = 0;
  let out = "";
  for (const b of buf) {
    valor = (valor << 8) | b;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALFA[(valor >>> bits) & 31];
    }
  }
  if (bits > 0) out += ALFA[(valor << (5 - bits)) & 31];
  return out;
}

const tenant = (process.argv[2] || "").trim().toLowerCase();
const esGlobal = !tenant;

const secreto = base32Encode(randomBytes(20)); // 160 bits, estándar TOTP
const issuer = "Centro de Comunicacion";
const cuenta = esGlobal ? "login" : tenant;
const label = `${issuer}:${cuenta}`;
const uri =
  `otpauth://totp/${encodeURIComponent(label)}` +
  `?secret=${secreto}&issuer=${encodeURIComponent(issuer)}` +
  `&algorithm=SHA1&digits=6&period=30`;

const envVar = esGlobal ? `TOTP_SECRET=${secreto}` : `TOTP_SECRETS=${tenant}:${secreto}`;

const linea = "-".repeat(64);
console.log(linea);
console.log(`  2FA por app  ${esGlobal ? "(GLOBAL: aplica a todos los tenants)" : `(tenant: ${tenant})`}`);
console.log(linea);
console.log("");
console.log("  1) Secreto (Base32) para escribir a mano en tu app de autenticación:");
console.log("");
console.log(`       ${secreto}`);
console.log("");
console.log("     En Google Authenticator: + > Ingresar clave de configuración >");
console.log("     Cuenta: " + cuenta + "  |  Clave: el secreto de arriba  |  Tipo: Basado en tiempo.");
console.log("");
console.log("  2) O escaneá un QR: pegá este otpauth:// en cualquier generador de QR");
console.log("     (o en la app si soporta pegar enlace):");
console.log("");
console.log(`       ${uri}`);
console.log("");
console.log("  3) Variable de entorno (Vercel del proyecto, y .env.local si probás local):");
console.log("");
console.log(`       ${envVar}`);
console.log("");
console.log(linea);
console.log("  Para varios tenants: TOTP_SECRETS=\"hospital:AAA...,grupoq:BBB...\"");
console.log("  Si NO ponés ninguna variable, el 2FA queda apagado (solo contraseña).");
console.log(linea);
