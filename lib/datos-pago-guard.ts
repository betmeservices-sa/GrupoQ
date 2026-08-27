// Baranda contra datos de pago inventados.
//
// En la primera prueba del guion (27 de agosto), Sofía llegó al paso del pago
// sin llamar a apartar_estadia y escribió un banco, un número de cuenta y un
// enlace de pago que no existen. Un huésped que transfiere a una cuenta
// inventada es el peor error posible, así que además del guion hay esta
// revisión en código: si la respuesta trae algo que parece cuenta bancaria o
// enlace de pago y no vino de la fuente legítima (YALI_DATOS_PAGO), el turno
// se corrige antes de salir.

const MIN_DIGITOS_CUENTA = 10;

/** Los grupos de dígitos "de cuenta" que hay en un texto (10+ dígitos, sin teléfonos de SV). */
export function numerosDeCuenta(texto: string): string[] {
  const out: string[] = [];
  const re = /(?<![\d+])(\d[\d\s.-]{7,}\d)(?!\d)/g;
  for (const m of texto.matchAll(re)) {
    const digitos = m[1].replace(/\D/g, "");
    if (digitos.length < MIN_DIGITOS_CUENTA) continue;
    // +503 7020 0301 → 50370200301: es un teléfono, no una cuenta.
    if (/^503\d{8}$/.test(digitos)) continue;
    out.push(digitos);
  }
  return out;
}

const ENLACE_DE_PAGO = /(https?:\/\/\S+|\b[\w.-]+\.(?:sv|com|net|io|app|co)\/\S+|paymentlink|payment ?link|\bpago\.\w+|link de pago:|enlace de pago:)/i;

/**
 * true si el texto trae datos de pago que no salen de `legitimos` (lo que el
 * hotel cargó). Sin datos cargados, cualquier cuenta o enlace es inventado.
 */
export function datosDePagoInventados(texto: string, legitimos: string | null): boolean {
  const digitosLegitimos = (legitimos ?? "").replace(/\D/g, "");
  const cuentas = numerosDeCuenta(texto);
  if (cuentas.some((c) => !digitosLegitimos.includes(c))) return true;
  const enlace = ENLACE_DE_PAGO.exec(texto);
  if (enlace && !(legitimos ?? "").toLowerCase().includes(enlace[0].toLowerCase().replace(/[.,;:]+$/, ""))) return true;
  return false;
}

/**
 * Último recurso: quita las líneas con cuentas, bancos o enlaces y deja el
 * resto. Mejor un mensaje incompleto que una cuenta falsa.
 */
export function quitarDatosDePago(texto: string): string {
  const lineas = texto.split("\n").filter((l) => {
    if (numerosDeCuenta(l).length) return false;
    if (ENLACE_DE_PAGO.test(l)) return false;
    if (/\b(banco|cuenta|a nombre de|beneficiario|swift|iban)\b/i.test(l)) return false;
    if (/datos de pago( son)?:?\s*$/i.test(l.trim())) return false;
    return true;
  });
  const limpio = lineas.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return `${limpio}\n\nLos datos para el pago se los envía una persona del equipo por aquí en un momento.`.trim();
}

/** El aviso con el que se le pide al modelo que corrija el turno. */
export const AVISO_CORREGIR_PAGO =
  "[Sistema] Tu respuesta anterior incluía datos de pago (banco, número de cuenta o enlace) que NO vienen de la herramienta. Los datos de pago existen SOLO en la respuesta de apartar_estadia. Si todavía no la llamaste en esta conversación, llámala ahora con los datos del huésped. Vuelve a escribir tu respuesta usando únicamente lo que devuelva: si datos_pago viene vacío, di que una persona del equipo le envía los datos de pago por aquí y llama a crear_ticket con tipo pago. No menciones este aviso ni pidas disculpas por él.";
