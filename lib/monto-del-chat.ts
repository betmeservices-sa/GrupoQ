// El monto que el lead dice POR ESCRITO, cuando está hablando de cuánto quiere
// financiar.
//
// POR QUÉ NO ALCANZA CON BUSCAR UN NÚMERO. En un chat de un concesionario los
// números son casi siempre otra cosa: "el 15 de octubre", "a las 3", "a 36
// meses", "puedo pagar 250 al mes", "mi número es 7539 1721", "un Hyundai
// 2018". Tomar cualquiera de esos como el monto del crédito mete plata falsa en
// el embudo, y la plata falsa se ve igual de bien que la verdadera.
//
// LAS DOS CONDICIONES, y tienen que darse las dos:
//   1. El mensaje habla de dinero o de querer algo (financiar, crédito, busco,
//      quiero, necesito, o un signo de dólar).
//   2. La cantidad viene con "mil", con "$" o es de por sí grande. Un "quiero
//      15" suelto no se toma como quince mil: por teléfono sí, porque ahí el
//      agente PREGUNTÓ el monto, pero acá nadie preguntó nada.
//
// Lo que no calza vuelve null y el caso se queda sin monto, que es una casilla
// que existe a propósito.

import { normalizar } from "./inmobiliaria-dictado";
import { MAXIMO, MINIMO, montoHablado } from "./monto-hablado";

/** El mensaje habla de plata o de querer algo. Sin esto no se mira ningún número. */
const INTENCION =
  /\b(financiar|financiamiento|financiado|credito|prestamo|presupuesto|enganche|prima|busco|buscando|quiero|queria|quisiera|necesito|ocupo|interesa|interesado|andaba viendo|ando viendo|ando buscando|me gustaria|disponible para|cuento con|tengo como)\b/;

/** O directamente habla en dinero. */
const MONEDA = /\$|\bdolares?\b|\bdls\b|\busd\b/;

/** Lo que viene DESPUÉS del número y lo convierte en otra cosa. */
const NO_ES_MONTO_DESPUES =
  /^\s*(meses?|anos?|quincenas?|semanas?|dias?|cuotas?|pagos?|km|kilometros?|puertas?|personas?|de\s+la\s+manana|de\s+la\s+tarde|am|pm|hrs?|horas?)\b/;

/** Cuota, no monto: "300 al mes", "250 mensuales". */
const ES_CUOTA = /^\s*(al\s+mes|por\s+mes|mensual(es|idad)?|cada\s+mes|quincenal(es)?|semanal(es)?)\b/;

/** Lo que viene ANTES y lo convierte en hora o en plazo. */
const NO_ES_MONTO_ANTES = /\b(a\s+las|las|desde\s+las|hasta\s+las|a\s+los|plazo\s+de|en)\s*$/;

/** Fecha escrita con barras o guiones: 15/10, 15-10-2026. */
const FECHA = /^\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?$/;

/** Un año, que en un concesionario es el del vehículo. */
const ANIO = /^(19|20)\d{2}$/;

/** Ocho dígitos salvadoreños: es un teléfono, no un monto. */
const TELEFONO = /^[267]\d{7}$/;

interface Candidato {
  texto: string;
  antes: string;
  despues: string;
  conDolar: boolean;
  conMultiplicador: boolean;
}

/** Las cantidades del mensaje, con lo que las rodea. */
function candidatos(t: string): Candidato[] {
  const out: Candidato[] = [];
  const re = /(\$\s*)?(\d[\d.,]*)\s*(mil(?:lones|lon)?|k\b)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    if (!m[2]) continue;
    out.push({
      texto: `${m[1] ? "$" : ""}${m[2]}${m[3] ? ` ${m[3]}` : ""}`,
      antes: t.slice(Math.max(0, m.index - 20), m.index),
      despues: t.slice(m.index + m[0].length, m.index + m[0].length + 20),
      conDolar: Boolean(m[1]),
      conMultiplicador: Boolean(m[3]),
    });
  }
  return out;
}

/**
 * El monto en dólares que se dijo en el mensaje, o null.
 *
 * `null` es la respuesta correcta la mayoría de las veces: en un chat, casi
 * ningún número es el monto del crédito.
 */
export function montoDelChat(texto?: string | null): number | null {
  const t = normalizar(texto ?? "").trim();
  if (!t) return null;
  if (!INTENCION.test(t) && !MONEDA.test(t)) return null;

  for (const c of candidatos(t)) {
    // El número crudo, sin separadores, para las formas que se reconocen tal cual.
    const crudo = c.texto.replace(/[^\d]/g, "");
    if (!c.conDolar && !c.conMultiplicador) {
      if (FECHA.test(c.texto.trim())) continue;
      if (ANIO.test(crudo)) continue;
      if (TELEFONO.test(crudo)) continue;
    }
    if (NO_ES_MONTO_DESPUES.test(c.despues)) continue;
    if (ES_CUOTA.test(c.despues)) continue;
    if (NO_ES_MONTO_ANTES.test(c.antes)) continue;

    const valor = montoHablado(c.texto);
    if (valor === null) continue;
    // Sin "mil" ni "$", solo cuenta si de por sí ya es un monto de crédito.
    // Así "quiero 15" no se vuelve quince mil: acá nadie preguntó el monto.
    if (!c.conDolar && !c.conMultiplicador && Number(crudo) < MINIMO) continue;
    if (valor < MINIMO || valor > MAXIMO) continue;
    return valor;
  }

  // En palabras: "ando buscando algo de quince mil".
  const enPalabras = t.match(/\b((?:[a-z]+\s+){0,4}mil(?:\s+[a-z]+){0,2})\b/);
  if (enPalabras) {
    const valor = montoHablado(enPalabras[1]);
    if (valor !== null && valor >= MINIMO && valor <= MAXIMO) return valor;
  }

  return null;
}
