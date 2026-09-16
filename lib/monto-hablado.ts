// Cuánto quiere financiar, sacado de lo que se dijo por teléfono.
//
// Sofía pregunta "¿de cuánto la anda pensando?" y el agente devuelve lo que
// oyó: "quince mil", "$12,500", "unos 20 mil dólares", "no sé todavía". El
// embudo necesita un número o nada: un monto inventado mueve la plata del
// tablero de Grupo Q y nadie lo nota, porque se ve igual de bien que uno real.
//
// Se apoya en los conversores del dictado (`numeroEnPalabras` y
// `numeroEnDigitos`), que ya están escritos y probados, y encima pone lo propio
// del crédito: el "mil" implícito, el rango razonable y la basura que hay que
// tirar. Se importan solo esas dos funciones puras; ese archivo no arrastra
// nada más que un tipo.

import { normalizar, numeroEnDigitos, numeroEnPalabras } from "./inmobiliaria-dictado";

/** Lo más chico que puede ser un crédito de vehículo. Abajo de esto es ruido. */
export const MINIMO = 500;

/** El techo. Arriba de esto no es un crédito de auto: es un error de lectura. */
export const MAXIMO = 500_000;

/**
 * El "mil" implícito: quien dice "quince" quiere decir quince mil.
 *
 * Nadie financia quince dólares, y el agente transcribe lo que oye. Se aplica
 * solo abajo de este número, para no tocar un "doce mil quinientos" que ya
 * viene completo.
 */
const HASTA_ES_EN_MILES = 100;

/** Frases con las que el agente dice que no hay dato. No son montos. */
const SIN_DATO = /^(no|nada|ninguno?|ningun[ao]|desconocid[ao]|n\/?a|null|undefined|sin\s|no\s)/;

/**
 * El monto en dólares, o null si no se dijo uno confiable.
 *
 * Prefiere no saber antes que adivinar: lo que no calza vuelve null y el lead
 * queda "sin monto" en el embudo, que es una casilla que existe a propósito.
 */
export function montoHablado(bruto?: string | number | null): number | null {
  if (typeof bruto === "number") return enRango(bruto);
  const texto = normalizar(String(bruto ?? "")).trim();
  if (!texto) return null;

  const hayDigitos = /\d/.test(texto);
  if (!hayDigitos && SIN_DATO.test(texto)) return null;

  // "quince mil", "veinte mil dolares": el número va en palabras.
  let valor = hayDigitos ? numeroDelTexto(texto) : numeroEnPalabrasSuelto(texto);
  if (valor === null || !Number.isFinite(valor) || valor <= 0) return null;

  // Multiplicadores dichos aparte del número: "15 mil", "1.5 millones".
  if (/\bmillon(es)?\b/.test(texto)) valor *= 1_000_000;
  else if (hayDigitos && /\bmil\b/.test(texto) && valor < 1000) valor *= 1000;
  else if (hayDigitos && /\d\s*k\b/.test(texto) && valor < 1000) valor *= 1000;

  if (valor < HASTA_ES_EN_MILES) valor *= 1000;

  return enRango(Math.round(valor));
}

function enRango(n: number): number | null {
  const v = Math.round(n);
  if (!Number.isFinite(v) || v < MINIMO || v > MAXIMO) return null;
  return v;
}

/** El primer número escrito con dígitos que aparezca en la frase. */
function numeroDelTexto(texto: string): number | null {
  const m = texto.match(/\$?\d[\d.,]*/);
  return m ? numeroEnDigitos(m[0]) : null;
}

/**
 * El número en palabras, venga donde venga en la frase.
 *
 * `numeroEnPalabras` corta en la primera palabra que no es número, así que
 * exige que la frase empiece por él. Por teléfono nadie contesta "quince mil":
 * contesta "como unos quince mil". Se prueba desde cada palabra y se toma el
 * primer número que aparezca.
 */
function numeroEnPalabrasSuelto(texto: string): number | null {
  const palabras = texto.match(/[a-z]+/g) ?? [];
  for (let i = 0; i < palabras.length; i++) {
    const v = numeroEnPalabras(palabras.slice(i).join(" "));
    if (v !== null && v > 0) return v;
  }
  return null;
}

/** "$15,000", para escribirlo en el historial del caso. */
export function comoDinero(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}
