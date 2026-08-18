// ============================================================================
// SUCURSALES DE HOTEL YALY  ·  ESTE ES EL ÚNICO ARCHIVO QUE HAY QUE EDITAR
// ============================================================================
//
// Los tres nombres de abajo son PLACEHOLDERS. El dueño todavía no dio los
// nombres reales ("sucursal a, b o c, por ejemplo"), así que quedaron marcados
// para que se vean a simple vista y no se filtre uno a producción por descuido.
//
// PARA PONER LOS NOMBRES REALES:
//   1. Cambia `nombre` de cada sucursal (y su `tagline`, si aplica).
//   2. Agrega en `alias` las formas en que un huésped la escribiría por
//      WhatsApp (sin acentos, en minúsculas, abreviada, mal escrita...).
//   3. NO toques los `id`: son la llave con la que se guarda en la base.
//   4. Corre `npm test`: hay una prueba que avisa si quedaron placeholders.
//
// La pregunta de sucursal es el PRIMER mensaje del agente, siempre, y se manda
// sin llamar al modelo (cuesta 0 tokens). Ver lib/sucursal-gate.ts.
// ============================================================================

import type { TenantSucursales } from "./types";

// Marca que delata un nombre sin reemplazar. La prueba de yaly.test.ts la busca
// y el panel del dashboard la puede mostrar en ámbar.
export const MARCA_PLACEHOLDER = "[PENDIENTE]";

export const yalySucursales: TenantSucursales = {
  // Primer mensaje, obligatorio, textual. Va tal cual por WhatsApp.
  pregunta: [
    "¡Hola! Le saluda Renata, de Hotel Yaly.",
    "Para atenderle bien, ¿a cuál de nuestras sucursales se está comunicando?",
    "",
    "A) Sucursal A [PENDIENTE]",
    "B) Sucursal B [PENDIENTE]",
    "C) Sucursal C [PENDIENTE]",
    "",
    "Puede responder solo con la letra.",
  ].join("\n"),

  // Cuando la respuesta no se entiende. Se reformula, no se repite igual.
  reintento: [
    "Perdón, no logré identificar la sucursal.",
    "Respóndame con la letra, por favor: A, B o C.",
    "",
    "A) Sucursal A [PENDIENTE]",
    "B) Sucursal B [PENDIENTE]",
    "C) Sucursal C [PENDIENTE]",
  ].join("\n"),

  // Cuántas veces se reformula la pregunta antes de pasar el chat a una persona.
  // Con 2, el huésped ve la pregunta hasta 3 veces (1 original + 2 reintentos).
  maxReintentos: 2,

  // Lo que se manda si tras los reintentos seguimos sin sucursal. NO se deja al
  // huésped colgado: se le avisa y el chat pasa a una persona (la IA se apaga
  // para ese número).
  handoff:
    "Para no hacerle perder tiempo, le paso con una persona del equipo que le ayuda enseguida. Gracias por su paciencia.",

  // OJO con los alias de UNA palabra: solo cuentan en mensajes cortos (ver
  // MAX_PALABRAS_RESPUESTA_CORTA). Por eso NO están "uno", "dos" ni "tres": en
  // un hotel aparecen todo el tiempo ("dos noches", "tres personas") y mandarían
  // al huésped a la sede equivocada.
  opciones: [
    {
      id: "a",
      nombre: "Sucursal A [PENDIENTE]",
      letra: "A",
      alias: ["a", "sucursal a", "la a", "opcion a", "1", "primera"],
    },
    {
      id: "b",
      nombre: "Sucursal B [PENDIENTE]",
      letra: "B",
      alias: ["b", "sucursal b", "la b", "opcion b", "2", "segunda"],
    },
    {
      id: "c",
      nombre: "Sucursal C [PENDIENTE]",
      letra: "C",
      alias: ["c", "sucursal c", "la c", "opcion c", "3", "tercera"],
    },
  ],
};

/** true si todavía hay nombres sin reemplazar (lo usa la prueba y el panel). */
export function tienePlaceholders(s: TenantSucursales = yalySucursales): boolean {
  return (
    s.pregunta.includes(MARCA_PLACEHOLDER) ||
    s.opciones.some((o) => o.nombre.includes(MARCA_PLACEHOLDER))
  );
}
