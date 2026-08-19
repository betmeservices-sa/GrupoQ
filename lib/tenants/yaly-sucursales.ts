// ============================================================================
// LAS TRES SEDES DE YALI HOSPITALITY  ·  ÚNICO ARCHIVO CON LOS NOMBRES
// ============================================================================
//
// Los nombres, las playas y los municipios salieron del sitio del cliente
// (yalihospitality.com): Yalí en Playa El Sunzal, Costa del Surf en Playa Las
// Flores y Playa Linda en la Carretera Litoral. Las tres son del mismo grupo,
// Sunzal Beach Club.
//
// SI CAMBIA UNA SEDE:
//   1. Cambia `nombre` (y la línea que la acompaña en `pregunta`).
//   2. Agrega en `alias` las formas en que un huésped la escribiría por
//      WhatsApp (sin acentos, en minúsculas, abreviada, mal escrita...).
//   3. NO toques los `id`: son la llave con la que se guarda la elección, y la
//      misma con la que lib/tenants/yali-inventario.ts declara sus habitaciones.
//   4. Corre `npm test`.
//
// La pregunta de sucursal es el PRIMER mensaje del agente, siempre, y se manda
// sin llamar al modelo (cuesta 0 tokens). Ver lib/sucursal-gate.ts.
// ============================================================================

import type { TenantSucursales } from "./types";

// Marca que delataría un nombre sin reemplazar. Hoy los tres son reales, así
// que `tienePlaceholders()` devuelve false y la prueba lo exige: si alguien
// vuelve a dejar un nombre a medias, se cae el test antes de llegar al cliente.
export const MARCA_PLACEHOLDER = "[PENDIENTE]";

export const yalySucursales: TenantSucursales = {
  // Primer mensaje, obligatorio, textual. Va tal cual por WhatsApp.
  pregunta: [
    "¡Hola! Le saluda Sofía, de Yali Hospitality.",
    "Para atenderle bien, ¿a cuál de nuestros hoteles se está comunicando?",
    "",
    "A) Yalí, Playa El Sunzal",
    "B) Costa del Surf, Playa Las Flores",
    "C) Playa Linda, Carretera Litoral",
    "",
    "Puede responder solo con la letra.",
  ].join("\n"),

  // Cuando la respuesta no se entiende. Se reformula, no se repite igual.
  reintento: [
    "Perdón, no logré identificar el hotel.",
    "Respóndame con la letra, por favor: A, B o C.",
    "",
    "A) Yalí, Playa El Sunzal",
    "B) Costa del Surf, Playa Las Flores",
    "C) Playa Linda, Carretera Litoral",
  ].join("\n"),

  // Cuántas veces se reformula la pregunta antes de pasar el chat a una persona.
  // Con 2, el huésped ve la pregunta hasta 3 veces (1 original + 2 reintentos).
  maxReintentos: 2,

  // Lo que se manda si tras los reintentos seguimos sin sede. NO se deja al
  // huésped colgado: se le avisa y el chat pasa a una persona (la IA se apaga
  // para ese número).
  handoff:
    "Para no hacerle perder tiempo, le paso con una persona del equipo que le ayuda enseguida. Gracias por su paciencia.",

  // OJO con los alias de UNA palabra: solo cuentan en mensajes cortos (ver
  // MAX_PALABRAS_RESPUESTA_CORTA). Por eso NO están "uno", "dos" ni "tres" (en
  // un hotel aparecen todo el tiempo: "dos noches", "tres personas"), ni "surf"
  // suelto ("quiero hacer surf" mandaría a Las Flores), ni "linda" suelto (en
  // El Salvador se usa como piropo y mandaría a Tamanique).
  opciones: [
    {
      id: "a",
      nombre: "Yalí, Playa El Sunzal",
      letra: "A",
      alias: [
        "a",
        "la a",
        "sucursal a",
        "opcion a",
        "1",
        "primera",
        "yali",
        "hotel yali",
        "sunzal",
        "el sunzal",
        "playa el sunzal",
      ],
    },
    {
      id: "b",
      nombre: "Costa del Surf, Playa Las Flores",
      letra: "B",
      alias: [
        "b",
        "la b",
        "sucursal b",
        "opcion b",
        "2",
        "segunda",
        "costa del surf",
        "costa surf",
        "las flores",
        "playa las flores",
        "usulutan",
      ],
    },
    {
      id: "c",
      nombre: "Playa Linda, Carretera Litoral",
      letra: "C",
      alias: [
        "c",
        "la c",
        "sucursal c",
        "opcion c",
        "3",
        "tercera",
        "playa linda",
        "hotel playa linda",
        "tamanique",
        "carretera litoral",
        "el litoral",
      ],
    },
  ],
};

/** true si quedó algún nombre sin reemplazar (lo usa la prueba y el panel). */
export function tienePlaceholders(s: TenantSucursales = yalySucursales): boolean {
  return (
    s.pregunta.includes(MARCA_PLACEHOLDER) ||
    s.opciones.some((o) => o.nombre.includes(MARCA_PLACEHOLDER))
  );
}
