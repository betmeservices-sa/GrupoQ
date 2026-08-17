// Crea (o actualiza) en Vapi el agente de voz de cobros de Banco Promerica.
//
//   node scripts/crear-agente-cobros.mjs            → crea o actualiza
//   node scripts/crear-agente-cobros.mjs --dry-run  → solo imprime el cuerpo
//
// El script del agente NO vive acá: vive en lib/cobros-agente.ts, versionado y
// revisable. Este archivo solo lo sube. Correrlo dos veces no duplica el
// agente: si ya existe uno con el mismo nombre, lo actualiza.
//
// Node 24 lee el .ts directamente (type stripping nativo), así que no hay
// copia del script en dos lugares que se puedan desincronizar.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { CONFIG_VAPI_COBROS } from "../lib/cobros-agente.ts";

const aqui = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(aqui, "..");
const VAPI = "https://api.vapi.ai";

function llaveVapi() {
  if (process.env.VAPI_PRIVATE_KEY) return process.env.VAPI_PRIVATE_KEY;
  try {
    const env = readFileSync(join(RAIZ, ".env.local"), "utf8");
    const m = /^VAPI_PRIVATE_KEY=(.+)$/m.exec(env);
    if (m) return m[1].trim();
  } catch {
    // sin .env.local: se cae al error de abajo
  }
  return null;
}

async function pedir(ruta, key, init = {}) {
  const res = await fetch(`${VAPI}${ruta}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    const m = cuerpo?.message;
    throw new Error(
      `Vapi respondió ${res.status} en ${ruta}: ${Array.isArray(m) ? m.join("; ") : m ?? "sin detalle"}`,
    );
  }
  return cuerpo;
}

const seco = process.argv.includes("--dry-run");

if (seco) {
  console.log(JSON.stringify(CONFIG_VAPI_COBROS, null, 2));
  process.exit(0);
}

const key = llaveVapi();
if (!key) {
  console.error("Falta VAPI_PRIVATE_KEY (ni en el entorno ni en .env.local).");
  process.exit(1);
}

const existentes = await pedir("/assistant?limit=100", key);
const previo = (Array.isArray(existentes) ? existentes : []).find(
  (a) => a.name === CONFIG_VAPI_COBROS.name,
);

const guardado = previo
  ? await pedir(`/assistant/${previo.id}`, key, {
      method: "PATCH",
      body: JSON.stringify(CONFIG_VAPI_COBROS),
    })
  : await pedir("/assistant", key, {
      method: "POST",
      body: JSON.stringify(CONFIG_VAPI_COBROS),
    });

console.log(previo ? "Agente actualizado." : "Agente creado.");
console.log(`  id:     ${guardado.id}`);
console.log(`  nombre: ${guardado.name}`);
console.log(`  modelo: ${guardado.model?.model ?? "-"}`);
console.log("");
console.log("Pegá ese id en lib/tenants/promerica.ts, en el bloque `voz`.");
