// La plantilla que abre el WhatsApp después de la llamada.
//
// POR QUÉ EXISTE. Sofía cierra la llamada de CrediQ diciendo "le escribo por
// WhatsApp para seguir con su solicitud", y no le escribía nadie. Las tres
// plantillas estaban aprobadas por Meta desde el 9 de septiembre y el único que
// llamaba a `enviarPlantilla` era el botón del chat, o sea una persona a mano.
// La promesa quedaba colgada y el lead se enfriaba solo.
//
// CADA ENVÍO ES UN WHATSAPP A UNA PERSONA REAL Y SE COBRA, así que la decisión
// vive acá, pura y probada, y son más las razones para NO mandar que para
// mandar:
//
//   - solo si dijo que sí EN LA LLAMADA (el agente lo pregunta y lo devuelve);
//   - solo si tenemos su nombre: la plantilla arranca con "Hola {{1}}!" y Meta
//     rechaza el parámetro vacío, así que "Hola !" ni siquiera se puede mandar;
//   - NUNCA dos veces a la misma persona;
//   - nunca si la ventana de 24 h está abierta: ahí el texto libre llega igual
//     y abrir una conversación con plantilla es pagar por nada;
//   - nunca sin número.
//
// Quien ejecuta es el webhook de fin de llamada (lib/memoria-webhook.ts).

/** La plantilla aprobada que abre la conversación después de la llamada. */
export const PLANTILLA_TRAS_LLAMADA = {
  nombre: "crediq_seguimiento_llamada",
  idioma: "es",
} as const;

/**
 * Un pedazo del cuerpo aprobado, para reconocer que ya se mandó.
 *
 * Se busca en el hilo en vez de llevar una tabla aparte: el mensaje enviado ya
 * queda guardado en el historial, y una tabla más sería otra cosa que se puede
 * desincronizar con lo que de verdad se envió.
 */
export const MARCA_TRAS_LLAMADA = "como quedamos en la llamada";

/** El cuerpo tal como quedó aprobado, con el nombre puesto. */
export function textoTrasLlamada(nombre: string): string {
  return `Hola ${nombre}! Soy Sofía de CrediQ, le escribo para seguir con su solicitud, como quedamos en la llamada. ¿Le parece si continuamos por aquí?`;
}

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
 * número no son nombres y no se le pueden poner a un "Hola".
 */
export function primerNombre(nombre?: string | null): string {
  const n = (nombre ?? "").trim().split(/\s+/)[0] ?? "";
  if (NO_ES_NOMBRE.has(plano(n))) return "";
  return /^[\p{L}\p{M}'’.-]{2,}$/u.test(n) ? n : "";
}

export interface EntradaPlantilla {
  /** Lo que contestó en la llamada cuando se le preguntó si le escribimos. */
  acepto: boolean;
  telefono: string;
  nombre?: string | null;
  /** El hilo de WhatsApp con esa persona, lo más reciente primero o al revés. */
  hilo: { direction: "in" | "out"; texto: string; ts: string }[];
  ahora: Date;
}

export type DecisionPlantilla =
  | { enviar: false; motivo: string }
  | { enviar: true; nombre: string; texto: string; plantilla: string; idioma: string };

const VENTANA_MS = 24 * 60 * 60 * 1000;

export function decidirPlantilla(e: EntradaPlantilla): DecisionPlantilla {
  if (!e.acepto) return { enviar: false, motivo: "no aceptó que le escribiéramos" };
  if (!/^\d{8,15}$/.test(e.telefono)) return { enviar: false, motivo: "sin número usable" };

  const nombre = primerNombre(e.nombre);
  if (!nombre) return { enviar: false, motivo: "no sabemos su nombre y la plantilla lo exige" };

  if (e.hilo.some((m) => m.direction === "out" && m.texto.includes(MARCA_TRAS_LLAMADA))) {
    return { enviar: false, motivo: "ya se le había mandado" };
  }

  // La ventana la abre el cliente al escribirnos. Si está abierta, el mensaje
  // libre llega igual y sale gratis.
  const ultimoEntrante = e.hilo
    .filter((m) => m.direction === "in")
    .map((m) => Date.parse(m.ts))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  if (ultimoEntrante && e.ahora.getTime() - ultimoEntrante < VENTANA_MS) {
    return { enviar: false, motivo: "la ventana de 24 h está abierta: se le puede escribir directo" };
  }

  return {
    enviar: true,
    nombre,
    texto: textoTrasLlamada(nombre),
    plantilla: PLANTILLA_TRAS_LLAMADA.nombre,
    idioma: PLANTILLA_TRAS_LLAMADA.idioma,
  };
}
