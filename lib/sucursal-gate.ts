// Las dos barandas del agente de WhatsApp, en un solo lugar y sin efectos:
//
//   1. PREGUNTA DE SUCURSAL OBLIGATORIA. Si el tenant tiene sedes, el PRIMER
//      mensaje del agente es siempre "¿a cuál sucursal se comunica?". No se le
//      pide al modelo que se acuerde de preguntarlo (se le olvidaría): el texto
//      sale de aquí, sin llamar a Claude, así que cuesta 0 tokens.
//
//   2. TOPE DURO DE MENSAJES por conversación / número / lead. Al llegar al
//      tope, el agente NO se queda callado: manda un cierre y el chat pasa a
//      una persona.
//
// Todo esto son funciones puras: deciden, no ejecutan. Quien ejecuta es
// lib/ai-reply.ts. Por eso se puede probar entero sin tocar WhatsApp ni Claude.

import type { SucursalTenant, TenantSucursales } from "./tenants/types";

// ── Las dos constantes que el dueño pidió poder mover ──

/** Tope de mensajes que el agente manda en UNA conversación. Se puede subir o
 *  bajar por tenant con `ai.limiteMensajes`. */
export const LIMITE_MENSAJES_IA_DEFAULT = 10;

/**
 * DECISIÓN TOMADA: la pregunta de sucursal SÍ cuenta dentro de los 10.
 *
 * Por qué: el tope es un presupuesto de "mensajes que este número recibe de
 * nosotros". Que la pregunta quedara fuera volvería el tope efectivo 11 y haría
 * imposible auditar de un vistazo cuántos mensajes salieron. Con esto la regla
 * es exacta: el agente NUNCA manda más de `limite` mensajes por conversación,
 * incluyendo la pregunta de sucursal, sus reintentos y el cierre.
 *
 * Para cambiarlo, poner false: se descontarían del contador los mensajes
 * deterministas de sucursal.
 */
export const PREGUNTA_SUCURSAL_CUENTA = true;

/** Mensaje de cierre al agotar el tope. Explícito: nadie queda colgado. */
export const CIERRE_POR_LIMITE =
  "Para darle una mejor atención le paso con una persona del equipo, que continúa con usted por este mismo chat. Gracias por escribirnos.";

// ── Decisión del turno ──

export type DecisionTurno =
  /** Mandar la pregunta de sucursal (primer mensaje). Sin modelo, 0 tokens. */
  | { tipo: "preguntar_sucursal"; texto: string }
  /** Se agotaron los intentos: avisar y pasar a una persona. */
  | { tipo: "handoff_sucursal"; texto: string }
  /**
   * Responder con la IA. `sucursal` es null si el tenant no maneja sedes O si
   * todavía no sabemos cuál es; en ese segundo caso `pedirSede` va en true y el
   * modelo se encarga: deduce el hotel de lo que dijo el huésped (aunque venga
   * mal escrito o mal transcrito) o lo pregunta con naturalidad.
   */
  | {
      tipo: "responder_ia";
      sucursal: SucursalTenant | null;
      recienElegida: boolean;
      pedirSede?: boolean;
    }
  /** Se llegó al tope: mandar el cierre y pasar a una persona. */
  | { tipo: "cerrar_por_limite"; texto: string }
  /** Ya se cerró antes. No mandar nada (ni gastar un token). */
  | { tipo: "silencio"; motivo: "limite" };

export interface EstadoTurno {
  /** Config de sedes del tenant, o undefined si no maneja sucursales. */
  sucursales?: TenantSucursales;
  /** Tope de mensajes del tenant. Si falta, LIMITE_MENSAJES_IA_DEFAULT. */
  limite?: number;
  /** Mensajes que YA salieron de nuestro lado en esta conversación. */
  mensajesAgente: number;
  /** De esos, cuántos fueron mensajes deterministas de sucursal. */
  mensajesSucursal: number;
  /** Sucursal ya confirmada por el contacto (id), o null. */
  sucursalId: string | null;
  /** Cuántas veces se preguntó ya por la sucursal. */
  intentos: number;
  /** Último texto que escribió el contacto (con el que se intenta identificar). */
  textoCliente: string;
  /**
   * Sede deducida del ORIGEN del contacto (anuncio o link de la bio de un
   * perfil), sin habérsela preguntado. Ver lib/origen-sede.ts.
   */
  origenSede?: SucursalTenant | null;
}

/** Mensajes que consumen presupuesto, según PREGUNTA_SUCURSAL_CUENTA. */
export function mensajesQueCuentan(e: {
  mensajesAgente: number;
  mensajesSucursal: number;
}): number {
  return PREGUNTA_SUCURSAL_CUENTA ? e.mensajesAgente : e.mensajesAgente - e.mensajesSucursal;
}

export function limiteDe(limite?: number): number {
  return limite && limite > 0 ? limite : LIMITE_MENSAJES_IA_DEFAULT;
}

/**
 * Qué hacer con este turno. El orden importa:
 *   tope agotado > cierre > sucursal > respuesta normal.
 * El cierre ocupa el ÚLTIMO cupo (el mensaje número `limite`), así el total de
 * mensajes salientes nunca pasa de `limite`.
 */
export function decidirTurno(e: EstadoTurno): DecisionTurno {
  const limite = limiteDe(e.limite);
  const usados = mensajesQueCuentan(e);

  // Ya se mandó el cierre: no se responde más.
  if (usados >= limite) return { tipo: "silencio", motivo: "limite" };

  // Queda UN cupo: se gasta en el cierre, no en otra respuesta a medias.
  if (usados === limite - 1) return { tipo: "cerrar_por_limite", texto: CIERRE_POR_LIMITE };

  // Sin sedes declaradas, el agente responde normal.
  if (!e.sucursales) return { tipo: "responder_ia", sucursal: null, recienElegida: false };

  const yaElegida = e.sucursalId
    ? (e.sucursales.opciones.find((o) => o.id === e.sucursalId) ?? null)
    : null;
  if (yaElegida) return { tipo: "responder_ia", sucursal: yaElegida, recienElegida: false };

  // ¿Se puede saber la sede sin preguntar? El link de la bio de cada perfil de
  // Instagram trae el nombre de su hotel prellenado, los anuncios traen el
  // referral de Meta (lib/origen-sede.ts), y muchas veces el huésped lo dice
  // solo. Preguntar algo que ya dijo es la forma más rápida de sonar a robot.
  const sinPreguntar = e.origenSede ?? interpretarSucursal(e.textoCliente, e.sucursales);
  if (sinPreguntar) {
    return { tipo: "responder_ia", sucursal: sinPreguntar, recienElegida: true };
  }

  // Agotados los intentos, pasa a una persona. Es la red de seguridad para el
  // caso raro en que ni el modelo logra sacar de qué hotel hablan.
  if (e.intentos > e.sucursales.maxReintentos) {
    return { tipo: "handoff_sucursal", texto: e.sucursales.handoff };
  }

  // Primer mensaje y un saludo pelado ("hola", "buenas"): no hay nada que
  // entender ni que responder, así que va la pregunta fija. Cuesta 0 tokens y
  // es el caso más común.
  if (e.intentos === 0 && esSaludoPelado(e.textoCliente)) {
    return { tipo: "preguntar_sucursal", texto: e.sucursales.pregunta };
  }

  // El huésped dijo algo con contenido (fechas, personas, un nombre mal
  // escrito) pero no logramos identificar la sede. Acá NO va un menú: contestar
  // "responda A, B o C" a quien acaba de dar sus fechas es justo lo que hace
  // sentir que del otro lado hay una máquina. Responde el modelo, que puede
  // deducir el hotel o preguntarlo dentro de una frase normal.
  return { tipo: "responder_ia", sucursal: null, recienElegida: false, pedirSede: true };
}

// ── Identificar la sucursal en lo que escribió el contacto ──

// OJO: el rango de acentos y el de espacios van con escape de verdad. Una
// versión anterior de este archivo perdió las barras invertidas y quedó
// `/s+/g`, que reemplaza la letra "s" por un espacio: "sunzal" se convertía en
// " unzal". Funcionaba de casualidad, porque el alias sufría lo mismo.
function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita los acentos (marcas combinantes)
    .replace(/[^a-z0-9\s]/g, " ") // signos fuera: "a)" -> "a"
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Hasta cuántas palabras se considera "una respuesta a la pregunta" y no una
 * frase suelta. Importa para los alias de UNA palabra: en español "a" es
 * preposición, así que "quiero ir a la playa" no puede leerse como "sucursal A".
 * Las respuestas de verdad ("A", "la B", "b por favor") son cortas.
 */
export const MAX_PALABRAS_RESPUESTA_CORTA = 4;

// Ordinales: una palabra, y aparecen en cualquier frase ("la primera vez").
// Como los alias de una letra o un número, solo cuentan si el mensaje es corto.
const ORDINALES = new Set(["primera", "segunda", "tercera", "primero", "segundo", "tercero"]);

/**
 * ¿Este alias es una "respuesta a la pregunta" y no un nombre?
 *
 * Las letras, los números y los ordinales aparecen en cualquier frase, así que
 * solo valen en mensajes cortos. Un NOMBRE PROPIO ("sunzal", "tamanique") vale
 * siempre: nadie lo escribe de casualidad, y quien lo menciona en medio de una
 * frase larga está diciendo a qué hotel le escribe.
 */
function esRespuestaCorta(alias: string): boolean {
  const partes = alias.split(" ").filter(Boolean);
  if (partes.length !== 1) return false; // "la b", "opcion c": no salen por azar
  return ORDINALES.has(alias) || alias.length < 4;
}

// Un alias calza si sus palabras aparecen SEGUIDAS y completas en el mensaje.
// Nada de substring crudo: "hola buenas tardes" contiene "la b" y elegiría la
// sucursal B. Los dos casos los cazan pruebas en sucursal-gate.test.ts.
function coincide(palabras: string[], alias: string): boolean {
  const norm = normalizar(alias);
  const partes = norm.split(" ").filter(Boolean);
  if (partes.length === 0) return false;
  if (esRespuestaCorta(norm) && palabras.length > MAX_PALABRAS_RESPUESTA_CORTA) return false;
  for (let i = 0; i + partes.length <= palabras.length; i++) {
    if (partes.every((parte, j) => palabras[i + j] === parte)) return true;
  }
  return false;
}

/**
 * Distancia de edición, cortada en `tope`. Es Levenshtein normal; el corte solo
 * evita seguir contando cuando ya sabemos que se pasó.
 */
export function distancia(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i];
    let mejor = i;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min(fila[j] + 1, siguiente[j - 1] + 1, fila[j - 1] + costo);
      siguiente.push(v);
      if (v < mejor) mejor = v;
    }
    if (mejor > tope) return tope + 1; // toda la fila se pasó: no hay vuelta
    fila = siguiente;
  }
  return fila[b.length];
}

/** Cuánto error se le tolera a una palabra según su largo. */
function tolerancia(palabra: string): number {
  if (palabra.length >= 8) return 2;
  if (palabra.length >= 5) return 1;
  return 0; // palabras cortas: exacto o nada
}

/**
 * Palabras que identifican a UNA sola sede.
 *
 * De todos los alias se sacan las palabras largas y se descartan las que
 * comparte más de una sede: "playa" está en las tres y no dice nada, pero
 * "sunzal", "tamanique" o "flores" apuntan a una sola. Son las únicas con las
 * que se puede arriesgar una comparación tolerante.
 */
function palabrasPropias(sucursales: TenantSucursales): Map<string, string[]> {
  const porPalabra = new Map<string, Set<string>>();
  for (const o of sucursales.opciones) {
    for (const alias of [o.nombre, ...o.alias]) {
      for (const p of normalizar(alias).split(" ")) {
        if (p.length < 5) continue;
        const set = porPalabra.get(p) ?? new Set<string>();
        set.add(o.id);
        porPalabra.set(p, set);
      }
    }
  }
  const salida = new Map<string, string[]>();
  for (const [palabra, sedes] of porPalabra) {
    if (sedes.size === 1) salida.set(palabra, [...sedes]);
  }
  return salida;
}

/**
 * Devuelve la sucursal que el contacto nombró, o null si no está claro.
 * Si el texto calza con MÁS de una, devuelve null: preferimos volver a
 * preguntar antes que mandarlo a la sede equivocada.
 *
 * Dos pasadas. La primera exige la palabra exacta. La segunda tolera errores de
 * tipeo y de transcripción, y es la que importa desde que el agente escucha
 * notas de voz: "Sunsal" en vez de "Sunzal" no puede costarle al huésped un
 * "responda A, B o C".
 */
export function interpretarSucursal(
  texto: string,
  sucursales: TenantSucursales,
): SucursalTenant | null {
  const palabras = normalizar(texto ?? "").split(" ").filter(Boolean);
  if (palabras.length === 0) return null;

  const exactas = sucursales.opciones.filter((o) =>
    [o.letra, o.nombre, ...o.alias].some((alias) => coincide(palabras, alias)),
  );
  if (exactas.length === 1) return exactas[0];
  // Más de una calza exacto: ambiguo, y adivinar sería mandarlo al hotel
  // equivocado. Ni siquiera se intenta la pasada tolerante.
  if (exactas.length > 1) return null;

  const propias = palabrasPropias(sucursales);
  const parecidas = new Set<string>();
  for (const palabra of palabras) {
    const tope = tolerancia(palabra);
    if (tope === 0) continue;
    for (const [clave, sedes] of propias) {
      if (distancia(palabra, clave, tope) <= tope) sedes.forEach((s) => parecidas.add(s));
    }
  }
  if (parecidas.size !== 1) return null;
  return sucursales.opciones.find((o) => o.id === [...parecidas][0]) ?? null;
}

// Saludos sueltos. Un "hola" no trae nada que entender ni que responder, así
// que ahí la pregunta fija de sede es lo correcto: es instantánea y cuesta 0
// tokens. En cambio "hola, somos 3 del 22 al 26" ya merece una respuesta de
// verdad, no un menú.
const SALUDOS = new Set([
  "hola", "holaa", "holaaa", "ola", "buenas", "buenos", "buen", "dia", "dias",
  "tardes", "noches", "tarde", "noche", "hey", "saludos", "que", "tal", "hi",
  "hello", "good", "morning", "afternoon", "evening", "gracias", "por", "favor",
]);

/**
 * La sede a partir de la página de Facebook o Instagram por la que escribió
 * la persona. En redes no hay que preguntar: "Playa Linda" es Playa Linda.
 * Se resuelve con los mismos alias que la respuesta del huésped.
 */
export function sucursalDePagina(
  sucursales: TenantSucursales | undefined,
  nombrePagina: string | null | undefined,
): SucursalTenant | null {
  if (!sucursales || !nombrePagina) return null;
  return interpretarSucursal(nombrePagina, sucursales);
}

export function esSaludoPelado(texto: string): boolean {
  const palabras = normalizar(texto ?? "").split(" ").filter(Boolean);
  if (palabras.length === 0) return true;
  if (palabras.length > 6) return false;
  return palabras.every((p) => SALUDOS.has(p) || p.length <= 2);
}


/** Línea que se le inyecta al system prompt una vez identificada la sede. */
export function contextoSucursal(s: SucursalTenant | null): string {
  if (!s) return "";
  return `\n\nSUCURSAL DEL CONTACTO: ${s.nombre}. El contacto ya la confirmó al inicio de la conversación. NO se la vuelvas a preguntar y responde SIEMPRE sobre esa sede. Si pide algo de otra sede, dile que le pasas con esa sucursal.`;
}
