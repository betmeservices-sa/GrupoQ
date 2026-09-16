// Las dos plantillas de WhatsApp que salen después de la llamada de CrediQ.
//
// POR QUÉ EXISTE. Sofía cierra la llamada diciendo "le escribo por WhatsApp
// para seguir con su solicitud", y no le escribía nadie: el único que llamaba a
// `enviarPlantilla` era el botón del chat, o sea una persona a mano. La promesa
// quedaba colgada y el lead se enfriaba solo.
//
// LA SECUENCIA, que son dos pasos y en este orden:
//
//   1. Al colgar: `crediq_seguimiento_requisitos`, con los cuatro papeles. Es
//      lo que la persona necesita para poder avanzar, y llega mientras todavía
//      se acuerda de la llamada.
//   2. Al minuto, SOLO si no contestó: `crediq_continuar_solicitud`, que
//      no repite la lista y le baja el escalón ("empiece por el que tenga a la
//      mano"). Quien no contestó al primero no necesita leer los requisitos de
//      nuevo: necesita que le digan que puede empezar por cualquiera.
//
// A QUIÉN SE LE ESCRIBE. A todo el que no haya dicho que NO. Quien no contestó
// el teléfono, cayó al buzón o colgó antes de que se le preguntara es
// justamente a quien hay que escribirle: la solicitud sigue ahí y el WhatsApp
// es el único camino que queda. La única puerta cerrada es la de quien dijo
// expresamente que no le escribiéramos.
//
// Y SE ESCRIBE EN CADA LLAMADA, no una sola vez en la vida del número. Antes
// valía una vez y punto: quien ya la había recibido semanas atrás colgaba la
// llamada siguiente esperando el mensaje, y no le llegaba nada. Es seguro
// porque sale al colgar, o sea una vez por llamada; el recordatorio, que sí lo
// dispara un barrido cada minuto, conserva su freno.
//
// CADA ENVÍO ES UN WHATSAPP A UNA PERSONA REAL Y SE COBRA, así que la decisión
// vive acá, pura y probada. Las razones para NO mandar están escritas en cada
// función.
//
// LOS CUERPOS SON LOS APROBADOS POR META, copiados tal cual. Si se cambia una
// coma acá y no allá, Meta rechaza el envío; y el texto que se guarda en el
// hilo tiene que ser el que de verdad le llegó a la persona.

export interface Plantilla {
  nombre: string;
  idioma: string;
  /** Un pedazo del cuerpo, para reconocer en el hilo que ya se mandó. */
  marca: string;
  /** El cuerpo aprobado, con el nombre puesto. */
  texto: (nombre: string) => string;
}

/** La primera: sale al colgar, con los cuatro requisitos. */
export const REQUISITOS: Plantilla = {
  nombre: "crediq_seguimiento_requisitos",
  idioma: "es",
  marca: "Estos son los requisitos que necesitamos",
  texto: (n) =>
    `Hola ${n}! Le escribimos de CrediQ para dar seguimiento a su solicitud de credito.\n\nEstos son los requisitos que necesitamos:\n1. DUI por ambos lados\n2. Constancia de salario\n3. Recibo de agua o luz reciente\n4. Dos referencias personales, con nombre y telefono\n\nLos puede enviar por este mismo medio, uno por uno, y le vamos confirmando cual ya recibimos. Si tiene alguna duda, escribanos por aqui.`,
};

/** La segunda: al minuto, solo si no contestó la primera. */
export const CONTINUAR: Plantilla = {
  nombre: "crediq_continuar_solicitud",
  idioma: "es",
  marca: "Empiece por el que tenga a la mano",
  texto: (n) =>
    `Hola ${n}! Soy Sofia de CrediQ, le hablo continuando con su solicitud.\n\nPor aqui me puede enviar los documentos que le comente en la llamada. Empiece por el que tenga a la mano y yo le voy diciendo cual falta.`,
};

/** ¿Este mensaje nuestro es una plantilla de CrediQ? (automática o mandada a mano) */
export function esPlantillaCrediQ(texto: string): boolean {
  return (
    texto.includes(REQUISITOS.marca) ||
    texto.includes(CONTINUAR.marca) ||
    /\[plantilla: crediq_/i.test(texto)
  );
}

/**
 * Cuánto se espera antes del recordatorio.
 *
 * Era 5 minutos. Bajó a 1 porque el seguimiento vale mientras la persona
 * todavía tiene el teléfono en la mano: a los cinco minutos ya se fue a otra
 * cosa. El barrido corre cada minuto, así que en la práctica sale entre uno y
 * dos minutos después.
 */
export const ESPERA_MIN = 1;

/**
 * Hasta cuándo tiene sentido el recordatorio.
 *
 * Pasadas estas horas ya no es "le sigo la conversación": es un mensaje de la
 * nada sobre una llamada que la persona ya no tiene fresca.
 */
export const TOPE_HORAS = 6;

const NO_ES_NOMBRE = new Set([
  // Rellenos que devuelve el agente cuando no lo entendió o no lo preguntó.
  "no", "sin", "ninguno", "desconocido", "desconocida", "n/a", "null", "undefined",
  // Lo que quedó de una frase, no un nombre: "el cliente", "la señora".
  "el", "la", "los", "las", "un", "una", "mi", "su", "cliente", "clienta",
  "senor", "senora", "senorita", "don", "dona", "usuario", "usuaria", "persona",
]);

/** Sin tildes y en minúsculas, para comparar contra la lista. */
function plano(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Solo el primer nombre, que es como se saluda, y solo si parece un nombre.
 *
 * El agente de voz transcribe lo que oye: "no especificado", "el cliente" o un
 * número no son nombres y no se le pueden poner a un "Hola". Meta además
 * rechaza el parámetro vacío, así que "Hola !" ni siquiera se puede mandar.
 */
export function primerNombre(nombre?: string | null): string {
  const n = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  if (NO_ES_NOMBRE.has(plano(n))) return "";
  return /^[\p{L}\p{M}'’.-]{2,}$/u.test(n) ? n : "";
}

export interface MensajeDelHilo {
  direction: "in" | "out";
  texto: string;
  ts: string;
}

export type Decision =
  | { enviar: false; motivo: string }
  | { enviar: true; nombre: string; texto: string; plantilla: string; idioma: string };

const VENTANA_MS = 24 * 60 * 60 * 1000;

function conNombre(p: Plantilla, nombre: string): Decision {
  return { enviar: true, nombre, texto: p.texto(nombre), plantilla: p.nombre, idioma: p.idioma };
}

/** Cuándo salió por última vez esta plantilla, o null si nunca. */
function ultimaVez(hilo: MensajeDelHilo[], p: Plantilla): number | null {
  const t = hilo
    .filter((m) => m.direction === "out" && m.texto.includes(p.marca))
    .map((m) => Date.parse(m.ts))
    .filter((x) => !Number.isNaN(x))
    .sort((a, b) => b - a)[0];
  return t ?? null;
}

/** Cuándo escribió el cliente por última vez, en milisegundos. */
function ultimoEntrante(hilo: MensajeDelHilo[]): number | null {
  const t = hilo
    .filter((m) => m.direction === "in")
    .map((m) => Date.parse(m.ts))
    .filter((x) => !Number.isNaN(x))
    .sort((a, b) => b - a)[0];
  return t ?? null;
}

export interface EntradaPlantilla {
  /**
   * Qué contestó cuando se le preguntó si le escribíamos.
   *
   * Tres estados y los tres importan: `true` dijo que sí, `false` dijo que NO
   * (y esa es la única puerta cerrada), y sin valor es que no se llegó a
   * preguntar, casi siempre porque no contestó el teléfono. A ese se le
   * escribe igual: su solicitud sigue abierta y el WhatsApp es lo único que
   * queda.
   */
  acepto?: boolean | null;
  telefono: string;
  nombre?: string | null;
  hilo: MensajeDelHilo[];
  ahora: Date;
}

/**
 * PASO 1, al colgar: los requisitos.
 *
 * No se manda si dijo que no, si no sabemos su nombre, si ya se le había
 * mandado, si el número no sirve, o si la ventana de 24 h está abierta, porque
 * ahí el texto libre llega igual y sale gratis.
 */
export function decidirPlantilla(e: EntradaPlantilla): Decision {
  // Solo el "no" expreso cierra la puerta. No contestar no es negarse.
  if (e.acepto === false) return { enviar: false, motivo: "dijo que no le escribiéramos" };
  if (!/^\d{8,15}$/.test(e.telefono)) return { enviar: false, motivo: "sin número usable" };

  const nombre = primerNombre(e.nombre);
  if (!nombre) return { enviar: false, motivo: "no sabemos su nombre y la plantilla lo exige" };

  // OJO: acá NO se mira si ya se le mandó antes. Cada llamada cierra con la
  // misma promesa ("le escribo los requisitos"), así que cada llamada la
  // cumple. Antes valía una sola vez en la vida del número y eso dejaba mudas
  // las llamadas siguientes: la persona colgaba esperando el mensaje y no le
  // llegaba nada. Esto sale UNA vez por llamada, no lo repite ningún barrido.
  const entrante = ultimoEntrante(e.hilo);
  if (entrante && e.ahora.getTime() - entrante < VENTANA_MS) {
    return { enviar: false, motivo: "la ventana de 24 h está abierta: se le puede escribir directo" };
  }

  return conNombre(REQUISITOS, nombre);
}

export interface EntradaRecordatorio {
  telefono: string;
  nombre?: string | null;
  hilo: MensajeDelHilo[];
  ahora: Date;
}

/**
 * PASO 2, al minuto: el recordatorio.
 *
 * Solo para quien recibió el de requisitos y NO contestó. Si contestó cualquier
 * cosa, aunque sea "ok", el recordatorio sobra y molesta: la conversación ya
 * está viva y ahí escribe una persona o la IA, gratis y sin plantilla.
 */
export function decidirRecordatorio(e: EntradaRecordatorio): Decision {
  if (!/^\d{8,15}$/.test(e.telefono)) return { enviar: false, motivo: "sin número usable" };

  const nombre = primerNombre(e.nombre);
  if (!nombre) return { enviar: false, motivo: "no sabemos su nombre y la plantilla lo exige" };

  const requisitos = ultimaVez(e.hilo, REQUISITOS);
  if (!requisitos) return { enviar: false, motivo: "nunca se le mandaron los requisitos" };

  // UN recordatorio POR TANDA, y acá el matiz importa en los dos sentidos.
  // Cuenta solo el que salió DESPUÉS de los últimos requisitos: si contara
  // cualquiera, a la segunda llamada al mismo número no llegaría nunca. Y sin
  // este corte, el barrido (que pasa cada minuto) lo mandaría una vez por
  // minuto hasta el tope de horas.
  const recordatorio = ultimaVez(e.hilo, CONTINUAR);
  if (recordatorio !== null && recordatorio > requisitos) {
    return { enviar: false, motivo: "ya se le recordó" };
  }

  // Contestó. La conversación está viva y no hace falta ninguna plantilla.
  const entrante = ultimoEntrante(e.hilo);
  if (entrante && entrante > requisitos) {
    return { enviar: false, motivo: "sí contestó: no hace falta recordarle nada" };
  }

  const minutos = Math.floor((e.ahora.getTime() - requisitos) / 60000);
  if (minutos < ESPERA_MIN) return { enviar: false, motivo: `todavía es pronto (${minutos} min)` };
  if (minutos > TOPE_HORAS * 60) {
    return { enviar: false, motivo: `ya pasó demasiado (${Math.floor(minutos / 60)} h)` };
  }

  return conNombre(CONTINUAR, nombre);
}
