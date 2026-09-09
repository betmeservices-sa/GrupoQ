// Cuando la persona pide por WhatsApp que la llamen, se le llama.
//
// POR QUÉ. El agente de voz cierra la llamada ofreciendo seguir por WhatsApp, y
// mucha gente contesta ahí un rato después: "ya salí de la reunión, me puede
// llamar". Hoy ese mensaje se quedaba en la bandeja hasta que alguien lo veía.
// El momento en que la persona dice que TIENE TIEMPO es el único momento en que
// la llamada de verdad sirve, y dura poco.
//
// POR QUÉ LA DETECCIÓN NO LA HACE UN MODELO. Una llamada telefónica cuesta,
// suena en el bolsillo de alguien y no se puede deshacer. Un gatillo que hay
// que adivinar por qué se disparó no se puede depurar ni defender ante el
// cliente. Acá se ve exactamente qué frases llaman y cuáles no, y se puede
// agregar una sin tocar nada más.
//
// LO QUE NO PUEDE HACER, y por eso son tantas condiciones:
//
//   - llamar a quien dijo que NO lo llamen (es el error más caro de todos);
//   - confundir "ya me llamaron" con "llámenme";
//   - llamar de madrugada;
//   - llamar dos veces por el mismo pedido;
//   - llamar sin contarle al agente de qué venían hablando: quien pide la
//     llamada acaba de escribir algo, y que le contesten desde cero es peor que
//     no llamar.
//
// La decisión es PURA para poder probarla sin red ni reloj. Quien la ejecuta es
// el webhook de WhatsApp.

/** Franja en la que se puede marcar, hora de El Salvador. */
export const DESDE_HORA = 8;
export const HASTA_HORA = 20;

/** Lo que se le responde por escrito al pedir la llamada. Y es la marca. */
export const AVISO_LLAMANDO = "le estamos marcando ahora mismo";

/** Sin tildes, en minúsculas y con los espacios parejos. */
function plano(texto: string): string {
  return (texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * "Llamame", en todas las formas en que se dice acá.
 *
 * Se cubren llamar y marcar, el usted y el vos, y el error de dedo típico
 * ("me pude llamar" por "me puede llamar"), que es como llegó el pedido que
 * originó esto.
 */
const PIDE = [
  /\b(me|nos)\s+(puede[ns]?|podria[ns]?|pueden|pod(e|e)s|pude[ns]?)\s+(llamar|marcar|telefonear)\b/,
  /\b(puede[ns]?|podria[ns]?|pod(e|e)s)\s+(llamar|marcar)me\b/,
  /\b(llame|llamen|llamame|llamenme|marque|marquen|marcame|marquenme|llamada)\s*(me|nos)?\b/,
  /\b(me|nos)\s+(llama|llaman|llamas|marca|marcan|marcas)\b/,
  /\bquiero\s+que\s+(me|nos)\s+(llame|llamen|marque|marquen)\b/,
  /\bprefiero\s+(que\s+(me|nos)\s+)?(llame|llamen|hablar por telefono)\b/,
  /\b(hablemos|hablamos)\s+por\s+(telefono|llamada)\b/,
];

/** "Ya tengo tiempo": la disponibilidad, que sola no pide nada. */
const DISPONIBLE = [
  /\bya\s+(tengo|puedo|estoy)\b/,
  /\bya\s+sali\b/,
  /\bestoy\s+(libre|disponible|desocupad)/,
  /\bahora\s+(si|puedo|estoy)\b/,
  /\btengo\s+tiempo\b/,
];

/**
 * Lo que PARECE un pedido y no lo es.
 *
 * El orden importa: esto se mira ANTES que nada. Llamar a quien pidió que no lo
 * llamen es el peor error que puede cometer esta función, y el único que el
 * cliente va a recordar.
 */
const NO_LLAMAR = [
  // Negado: "no me llamen", "mejor no me llame", "ya no me llamen".
  /\bno\s+(me|nos)\s+(vuelvan?\s+a\s+)?(llame|llamen|llamar|marque|marquen|marcar|llama|marca)\b/,
  /\b(no|nunca)\s+(quiero|deseo)\s+(que\s+)?(me|nos)?\s*(llame|llamen|llamar|marquen)\b/,
  /\bdejen?\s+de\s+(llamar|marcar)\b/,
  /\bno\s+(puedo|pueden)\s+(hablar|contestar|atender)\b/,
  /\bmejor\s+(por\s+)?(aqui|whatsapp|escrito|mensaje|chat)\b/,
  /\bprefiero\s+(por\s+)?(aqui|whatsapp|escrito|mensaje|chat)\b/,
  // Pasado: ya ocurrió, no lo está pidiendo.
  /\b(ya\s+)?(me|nos)\s+(llamaron|llamo|marcaron|marco|hablaron)\b/,
  /\bme\s+acaban?\s+de\s+llamar\b/,
  /\bno\s+(me\s+)?(contestaron|contesto|entro la llamada)\b/,
];

/**
 * ¿Este mensaje pide una llamada?
 *
 * Pide si dice explícitamente que lo llamen, o si dice que ya tiene tiempo Y
 * menciona hablar. "Ya tengo tiempo" a secas no alcanza: puede estar
 * contestando otra cosa.
 */
export function pideLlamada(texto: string): boolean {
  const t = plano(texto);
  if (!t) return false;
  if (NO_LLAMAR.some((re) => re.test(t))) return false;
  if (PIDE.some((re) => re.test(t))) return true;
  // "Ya salí de la reunión, podemos hablar" sin decir "llamar".
  return DISPONIBLE.some((re) => re.test(t)) && /\bhablar\b|\bplaticar\b|\bconversar\b/.test(t);
}

export interface MensajeDelHilo {
  direction: "in" | "out";
  texto: string;
  ts: string;
}

/**
 * Lo que ya se habló, para que el agente no arranque de cero.
 *
 * Va tal cual al guion como {{contexto}}. Se manda el diálogo y no un resumen
 * inventado por nosotros: si el agente va a mencionar algo que la persona dijo,
 * tiene que ser lo que dijo, no nuestra interpretación.
 *
 * Del más viejo al más nuevo, y recortado por el final: lo último que se habló
 * es lo que la persona tiene fresco.
 */
export function contextoDelChat(mensajes: MensajeDelHilo[], tope = 1200): string {
  const hilo = [...mensajes]
    .sort((a, b) => (a.ts < b.ts ? -1 : 1))
    .filter((m) => (m.texto ?? "").trim())
    .map((m) => `${m.direction === "in" ? "Cliente" : "Nosotros"}: ${m.texto.replace(/\s+/g, " ").trim()}`);

  let salida = "";
  // Se arma desde el final para que, al no caber todo, sobreviva lo reciente.
  for (let i = hilo.length - 1; i >= 0; i--) {
    const siguiente = salida ? `${hilo[i]}\n${salida}` : hilo[i];
    if (siguiente.length > tope) break;
    salida = siguiente;
  }
  return salida;
}

export interface EntradaLlamada {
  /** Lo último que escribió la persona. */
  texto: string;
  telefono: string;
  nombre?: string | null;
  hilo: MensajeDelHilo[];
  /** false = alguien del equipo tiene el chat y llama quien quiera llamar. */
  sinDueno: boolean;
  ahora: Date;
  /** La hora de El Salvador, que la resuelve quien llama para no atar la zona acá. */
  horaLocal: number;
}

export type Decision =
  | { llamar: false; motivo: string }
  | { llamar: true; contexto: string; primerMensaje: string; aviso: string };

/** Solo el primer nombre, y solo si parece uno. */
export function primerNombre(nombre?: string | null): string {
  const n = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  return /^[\p{L}\p{M}'’.-]{2,}$/u.test(n) && !/^(no|sin|el|la|cliente|usuario)$/i.test(n) ? n : "";
}

/** Cuánto se espera antes de aceptar otro pedido del mismo número. */
export const REPETIR_MIN = 30;

export function decidirLlamada(e: EntradaLlamada): Decision {
  if (!pideLlamada(e.texto)) return { llamar: false, motivo: "no pidió que lo llamaran" };
  if (!/^\d{8,15}$/.test(e.telefono)) return { llamar: false, motivo: "sin número usable" };

  if (!e.sinDueno) {
    // Una persona del equipo está en ese chat. Que marque quien está hablando,
    // no un robot por encima de ella.
    return { llamar: false, motivo: "el chat lo tiene una persona: le toca a ella marcar" };
  }

  if (e.horaLocal < DESDE_HORA || e.horaLocal >= HASTA_HORA) {
    return { llamar: false, motivo: `fuera de horario (son las ${e.horaLocal} en El Salvador)` };
  }

  // Ya se le marcó por un pedido reciente. Si no contestó, insistir a los dos
  // minutos es acoso; y si contestó, ya se habló.
  const ultimoAviso = e.hilo
    .filter((m) => m.direction === "out" && m.texto.includes(AVISO_LLAMANDO))
    .map((m) => Date.parse(m.ts))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  if (ultimoAviso && e.ahora.getTime() - ultimoAviso < REPETIR_MIN * 60_000) {
    const min = Math.floor((e.ahora.getTime() - ultimoAviso) / 60_000);
    return { llamar: false, motivo: `ya se le marcó hace ${min} min` };
  }

  const nombre = primerNombre(e.nombre);
  const contexto = contextoDelChat(e.hilo);

  return {
    llamar: true,
    contexto,
    // Quien pidió la llamada no puede recibir una que arranque preguntando con
    // quién tiene el gusto: acaba de escribir pidiéndola.
    primerMensaje: nombre
      ? `Hola ${nombre}, le saluda Sofía de CrediQ. Le marco como me pidió por WhatsApp. ¿Puede hablar ahora?`
      : "Buenas, le saluda Sofía de CrediQ. Le marco como me pidió por WhatsApp. ¿Puede hablar ahora?",
    aviso: `${nombre ? `${nombre}, con` : "Con"} gusto: ${AVISO_LLAMANDO}.`,
  };
}
