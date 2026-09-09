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
//   2. A los 5 minutos, SOLO si no contestó: `crediq_continuar_solicitud`, que
//      no repite la lista y le baja el escalón ("empiece por el que tenga a la
//      mano"). Quien no contestó al primero no necesita leer los requisitos de
//      nuevo: necesita que le digan que puede empezar por cualquiera.
//
// CADA ENVÍO ES UN WHATSAPP A UNA PERSONA REAL Y SE COBRA, así que la decisión
// vive acá, pura y probada, y son más las razones para NO mandar que para
// mandar. Están escritas en cada función.
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

/** La segunda: a los 5 minutos, solo si no contestó la primera. */
export const CONTINUAR: Plantilla = {
  nombre: "crediq_continuar_solicitud",
  idioma: "es",
  marca: "Empiece por el que tenga a la mano",
  texto: (n) =>
    `Hola ${n}! Soy Sofia de CrediQ, le hablo continuando con su solicitud.\n\nPor aqui me puede enviar los documentos que le comente en la llamada. Empiece por el que tenga a la mano y yo le voy diciendo cual falta.`,
};

/** Cuánto se espera antes del recordatorio. */
export const ESPERA_MIN = 5;

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

/** ¿Ya se le mandó esta plantilla alguna vez? */
function yaSeMando(hilo: MensajeDelHilo[], p: Plantilla): boolean {
  return hilo.some((m) => m.direction === "out" && m.texto.includes(p.marca));
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
  /** Lo que contestó en la llamada cuando se le preguntó si le escribimos. */
  acepto: boolean;
  telefono: string;
  nombre?: string | null;
  hilo: MensajeDelHilo[];
  ahora: Date;
}

/**
 * PASO 1, al colgar: los requisitos.
 *
 * No se manda si no aceptó, si no sabemos su nombre, si ya se le había mandado,
 * si el número no sirve, o si la ventana de 24 h está abierta, porque ahí el
 * texto libre llega igual y sale gratis.
 */
export function decidirPlantilla(e: EntradaPlantilla): Decision {
  if (!e.acepto) return { enviar: false, motivo: "no aceptó que le escribiéramos" };
  if (!/^\d{8,15}$/.test(e.telefono)) return { enviar: false, motivo: "sin número usable" };

  const nombre = primerNombre(e.nombre);
  if (!nombre) return { enviar: false, motivo: "no sabemos su nombre y la plantilla lo exige" };

  if (yaSeMando(e.hilo, REQUISITOS)) return { enviar: false, motivo: "ya se le había mandado" };

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
 * PASO 2, a los 5 minutos: el recordatorio.
 *
 * Solo para quien recibió el de requisitos y NO contestó. Si contestó cualquier
 * cosa, aunque sea "ok", el recordatorio sobra y molesta: la conversación ya
 * está viva y ahí escribe una persona o la IA, gratis y sin plantilla.
 */
export function decidirRecordatorio(e: EntradaRecordatorio): Decision {
  if (!/^\d{8,15}$/.test(e.telefono)) return { enviar: false, motivo: "sin número usable" };

  const nombre = primerNombre(e.nombre);
  if (!nombre) return { enviar: false, motivo: "no sabemos su nombre y la plantilla lo exige" };

  if (yaSeMando(e.hilo, CONTINUAR)) return { enviar: false, motivo: "ya se le recordó" };

  const requisitos = e.hilo
    .filter((m) => m.direction === "out" && m.texto.includes(REQUISITOS.marca))
    .map((m) => Date.parse(m.ts))
    .filter((x) => !Number.isNaN(x))
    .sort((a, b) => b - a)[0];
  if (!requisitos) return { enviar: false, motivo: "nunca se le mandaron los requisitos" };

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
