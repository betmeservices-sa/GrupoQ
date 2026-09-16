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
//   - llamar dos veces por el mismo mensaje;
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
 * Dijo que NO lo llamen.
 *
 * Se mira ANTES que nada: llamar a quien pidió que no lo llamen es el peor error
 * que puede cometer esta función, y el único que el cliente va a recordar.
 */
const NEGADO = [
  // "no me llamen", "mejor no me llame", "ya no me llamen".
  /\bno\s+(me|nos)\s+(vuelvan?\s+a\s+)?(llame|llamen|llamar|marque|marquen|marcar|llama|marca)\b/,
  /\b(no|nunca)\s+(quiero|deseo)\s+(que\s+)?(me|nos)?\s*(llame|llamen|llamar|marquen)\b/,
  /\bdejen?\s+de\s+(llamar|marcar)\b/,
  /\bno\s+(puedo|pueden)\s+(hablar|contestar|atender)\b/,
  /\bmejor\s+(por\s+)?(aqui|whatsapp|escrito|mensaje|chat)\b/,
  /\bprefiero\s+(por\s+)?(aqui|whatsapp|escrito|mensaje|chat)\b/,
];

/**
 * Hubo una llamada que no se completó: "no me contestaron", "no pude
 * contestar", "se cortó la llamada". No pide la llamada con esas palabras, así
 * que se le PREGUNTA si quiere que le llamen de vuelta.
 */
const PERDIDA = [
  /\bno\s+(me\s+)?(contestaron|contesto|contestan|contestaste)\b/,
  /\bno\s+(les?\s+)?conteste\b/,
  /\bno\s+(pude|alcance\s+a|alcance|logre)\s+(contestar|atender)\b/,
  /\bno\s+(me\s+)?entro\s+la\s+llamada\b/,
  /\b(se\s+)?(corto|cayo)\s+la\s+llamada\b/,
  /\bllamada\s+perdida\b/,
  /\bquien\s+me\s+(llamo|marco)\b/,
];

/** Ya ocurrió y no pide nada: "ya me llamaron", o se presenta: "me llamo Karla". */
const PASADO = [
  /\b(ya\s+)?(me|nos)\s+(llamaron|llamo|marcaron|marco|hablaron)\b/,
  /\bme\s+acaban?\s+de\s+llamar\b/,
];

export type Intencion = "llamar" | "preguntar" | null;

/**
 * Qué hacer con este mensaje: llamar, preguntar si quiere que lo llamen, o nada.
 *
 * Llama si dice explícitamente que lo llamen, o si dice que ya tiene tiempo Y
 * menciona hablar ("ya tengo tiempo" a secas puede estar contestando otra
 * cosa). Pregunta si cuenta que una llamada no se completó.
 */
export function intencionDeLlamada(texto: string): Intencion {
  const t = plano(texto);
  if (!t) return null;
  if (NEGADO.some((re) => re.test(t))) return null;

  const pide = (s: string) =>
    PIDE.some((re) => re.test(s)) ||
    // "Ya salí de la reunión, podemos hablar" sin decir "llamar".
    (DISPONIBLE.some((re) => re.test(s)) && /\bhablar\b|\bplaticar\b|\bconversar\b/.test(s));

  // La llamada perdida va ANTES que el pedido porque "se cortó la llamada" ya
  // dice "llamada". Se saca ese pedazo y se mira si ADEMÁS pide que lo llamen.
  // Lo mismo con el pasado: "me llamo Karla" o "ya me llamaron" no piden nada,
  // pero "ya me llamaron, llámenme otra vez" sí.
  const sin = (s: string, lista: RegExp[]) =>
    lista.reduce((acc, re) => acc.replace(new RegExp(re.source, "g"), " "), s);
  const resto = sin(sin(t, PERDIDA), PASADO);
  if (pide(resto)) return "llamar";
  return PERDIDA.some((re) => re.test(t)) ? "preguntar" : null;
}

/** ¿Este mensaje pide una llamada? */
export function pideLlamada(texto: string): boolean {
  return intencionDeLlamada(texto) === "llamar";
}

/** La pregunta que se le hace tras una llamada que no se completó. Y es la marca. */
export const PREGUNTA_VOLVER = "¿Quiere que le llame de vuelta ahora?";

/**
 * "Sí", "claro", "dale, por favor": la respuesta a la pregunta de si le
 * llamamos. Si trae "más tarde", "mañana" o un "no", no es un sí para AHORA.
 */
export function esAfirmativo(texto: string): boolean {
  const t = plano(texto).replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (/\bno\b|\bmas tarde\b|\bluego\b|\bdespues\b|\bmanana\b|\botro dia\b|\bahorita no\b/.test(t)) return false;
  return /^(si+|claro|dale|ok|okey|okay|oki|va|vaya|bueno|esta bien|de acuerdo|por favor|porfa|sale|simon|correcto|ahora|ahorita|llameme|llamame|marqueme|marcame)\b/.test(t);
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
  | { llamar: false; motivo: string; /** Si viene, se le manda esta pregunta por escrito. */ pregunta?: string }
  | { llamar: true; contexto: string; primerMensaje: string; aviso: string };

/** Solo el primer nombre, y solo si parece uno. */
export function primerNombre(nombre?: string | null): string {
  const n = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  return /^[\p{L}\p{M}'’.-]{2,}$/u.test(n) && !/^(no|sin|el|la|cliente|usuario)$/i.test(n) ? n : "";
}

/** El último mensaje nuestro, si lo hay. */
function ultimoSaliente(hilo: MensajeDelHilo[]): MensajeDelHilo | undefined {
  return hilo
    .filter((m) => m.direction === "out" && !Number.isNaN(Date.parse(m.ts)))
    .sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts))[0];
}

export function decidirLlamada(e: EntradaLlamada): Decision {
  let intencion = intencionDeLlamada(e.texto);
  // "Sí" a la pregunta de si le llamamos de vuelta: cuenta como pedirlo.
  if (!intencion && esAfirmativo(e.texto) && ultimoSaliente(e.hilo)?.texto.includes(PREGUNTA_VOLVER)) {
    intencion = "llamar";
  }
  if (!intencion) return { llamar: false, motivo: "no pidió que lo llamaran" };
  if (!/^\d{8,15}$/.test(e.telefono)) return { llamar: false, motivo: "sin número usable" };

  if (!e.sinDueno) {
    // Una persona del equipo está en ese chat. Que marque quien está hablando,
    // no un robot por encima de ella.
    return { llamar: false, motivo: "el chat lo tiene una persona: le toca a ella marcar" };
  }

  if (e.horaLocal < DESDE_HORA || e.horaLocal >= HASTA_HORA) {
    return { llamar: false, motivo: `fuera de horario (son las ${e.horaLocal} en El Salvador)` };
  }

  // Cada mensaje nuevo que pide llamada, marca. Lo único que no se atiende dos
  // veces es el MISMO mensaje (Meta a veces entrega el webhook repetido): si el
  // aviso o la pregunta son posteriores al último mensaje de la persona, ese
  // mensaje ya se atendió.
  const ultimo = (dir: "in" | "out", pred: (m: MensajeDelHilo) => boolean = () => true) =>
    e.hilo
      .filter((m) => m.direction === dir && pred(m))
      .map((m) => Date.parse(m.ts))
      .filter((t) => !Number.isNaN(t))
      .sort((a, b) => b - a)[0];
  const ultimaRespuesta = ultimo(
    "out",
    (m) => m.texto.includes(AVISO_LLAMANDO) || m.texto.includes(PREGUNTA_VOLVER),
  );
  const ultimoDeLaPersona = ultimo("in");
  if (ultimaRespuesta && ultimoDeLaPersona && ultimaRespuesta > ultimoDeLaPersona) {
    return { llamar: false, motivo: "ese mensaje ya se atendió" };
  }

  const nombre = primerNombre(e.nombre);

  if (intencion === "preguntar") {
    return {
      llamar: false,
      motivo: "se le preguntó si quiere que le llamen de vuelta",
      pregunta: `${nombre ? `No se preocupe, ${nombre}.` : "No se preocupe."} ${PREGUNTA_VOLVER}`,
    };
  }
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
