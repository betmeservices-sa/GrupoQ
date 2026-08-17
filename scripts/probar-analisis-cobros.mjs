// Prueba el análisis de llamadas de cobranza contra la API de verdad.
//
//   node scripts/probar-analisis-cobros.mjs
//
// Corre el MISMO camino que usa el webhook: toma una transcripción real de la
// cartera semilla, se la manda a Claude con salida estructurada, y aplica el
// resultado a la ficha para enseñar cómo queda. No marca teléfonos y no escribe
// en el almacén del demo: solo lee.
//
// Sirve para lo que no se puede ver de otra forma: que el JSON que devuelve el
// modelo calza con el esquema y que la tarjeta del cliente se mueve como debe.

import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

// Los módulos de lib/ se importan entre ellos sin extensión ("./cobros-tipos"),
// que es lo correcto para TypeScript pero no resuelve en el ESM de Node. Este
// gancho le agrega el .ts cuando la resolución normal falla, para poder correr
// el código de producción tal cual, sin una copia paralela que se desincronice.
registerHooks({
  resolve(especificador, contexto, siguiente) {
    try {
      return siguiente(especificador, contexto);
    } catch (err) {
      if (especificador.startsWith(".") && !/\.[a-z]+$/i.test(especificador)) {
        return siguiente(`${especificador}.ts`, contexto);
      }
      throw err;
    }
  },
});

// El .env.local se carga a mano y ANTES de importar el módulo de IA: ese módulo
// construye el cliente de Anthropic al evaluarse, así que si la llave entra
// después, entra tarde.
function cargarEnv() {
  let texto;
  try {
    texto = readFileSync(join(RAIZ, ".env.local"), "utf8");
  } catch {
    return;
  }
  for (const linea of texto.split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(linea.trim());
    if (!m) continue;
    const valor = m[2].replace(/^"|"$/g, "").trim();
    if (valor && !process.env[m[1]]) process.env[m[1]] = valor;
  }
}

// Salir con process.exit deja el gancho de resolución a medio cerrar y Node
// revienta con una aserción de libuv en Windows. Se corta con una excepción
// propia y se deja que el proceso termine solo.
class Salida extends Error {}

function abortar(mensaje) {
  console.error(mensaje);
  process.exitCode = 1;
  throw new Salida(mensaje);
}

async function principal() {
  cargarEnv();

  const llave = process.env.ANTHROPIC_API_KEY;
  if (!llave) abortar("Falta ANTHROPIC_API_KEY en .env.local o en el entorno.");

  // Nunca la llave completa: solo lo suficiente para saber CUÁL se está usando.
  console.log(`Llave:  ${llave.slice(0, 18)}...${llave.slice(-6)}`);
  console.log(`Modelo: ${process.env.COBROS_AI_MODEL || "claude-opus-5"}\n`);

  const { DEUDORES_SEMILLA } = await import("../lib/cobros-datos.ts");
  const { analizarLlamada, aplicarAnalisis, mensajeDeError } = await import("../lib/cobros-ia.ts");
  const { hoyEnSv, resolverDeudor } = await import("../lib/cobros-cartera.ts");

  // La primera cuenta que traiga una transcripción de verdad en su historial.
  let deudor = null;
  let gestion = null;
  for (const d of DEUDORES_SEMILLA) {
    const g = d.gestiones.find((x) => (x.transcript ?? "").length > 100);
    if (g) {
      deudor = d;
      gestion = g;
      break;
    }
  }
  if (!deudor) abortar("Ninguna cuenta de la cartera semilla trae transcripción.");

  console.log(`Cliente:      ${deudor.nombre}`);
  console.log(`Cuenta:       ${deudor.producto} ${deudor.cuenta}`);
  console.log(`Vencido:      $${deudor.montoVencido.toFixed(2)} con ${deudor.diasMora} días de mora`);
  console.log(`Estado antes: ${deudor.estado}\n`);
  console.log("Leyendo la llamada con Claude...\n");

  let analisis;
  try {
    analisis = await analizarLlamada({
      deudor,
      transcript: gestion.transcript,
      duracionSeg: gestion.duracionSeg,
      endedReason: "customer-ended-call",
    });
  } catch (err) {
    abortar(`FALLO: ${mensajeDeError(err)}`);
  }
  if (!analisis) abortar("El modelo no devolvió análisis.");

  console.log("Lo que devolvió el modelo:");
  console.log(JSON.stringify(analisis, null, 2));

  const despues = aplicarAnalisis(deudor, analisis, {
    ahora: new Date(),
    hoy: hoyEnSv(),
    callId: gestion.callId,
    duracionSeg: gestion.duracionSeg,
    transcript: gestion.transcript,
  });
  const vista = resolverDeudor(despues, hoyEnSv());

  console.log("\nCómo queda la ficha:");
  console.log(`  Estado:    ${deudor.estado}  ->  ${vista.estado}`);
  console.log(`  Riesgo:    ${deudor.riesgo}  ->  ${vista.riesgo}`);
  console.log(`  Llamable:  ${deudor.llamable}  ->  ${vista.llamable}`);
  console.log(
    `  Promesa:   ${vista.promesa ? `$${vista.promesa.monto.toFixed(2)} el ${vista.promesa.fecha}` : "sin promesa"}`,
  );
  console.log(`  Siguiente: ${vista.proximaAccion?.tipo ?? "-"}`);
  console.log(`  Resumen:   ${vista.resumenIa}`);
  console.log("\nListo. Nada de esto se guardó: la prueba no toca el almacén del demo.");
}

try {
  await principal();
} catch (err) {
  if (!(err instanceof Salida)) throw err;
}
