// La ficha de contacto se guarda por "de dónde escribe": un teléfono en
// WhatsApp, o "instagram:pagina:persona" / "facebook:pagina:persona" en Meta.
// Estas dos funciones traducen entre esa llave y lo que ve el equipo.

import { telefonoBonito } from "./phone";

const META = /^(instagram|facebook):(\d+):(\d+)$/;

/** La llave de contacto a partir de la clave de conversación ("wa:503..." → "503..."). */
export function contactoDeClave(clave: string): string {
  return clave.startsWith("wa:") ? clave.slice(3) : clave;
}

/** Cómo se muestra el "teléfono" de una ficha: número, o el canal si es de Meta. */
export function etiquetaDeContacto(from: string): string {
  const m = META.exec(from);
  if (m) return m[1] === "instagram" ? "Mensaje directo de Instagram" : "Messenger de Facebook";
  if (from.startsWith("prueba:")) return "Chat de prueba";
  return telefonoBonito(from);
}

/** true si la ficha viene de Messenger o Instagram (no tiene teléfono). */
export function esContactoDeMeta(from: string): boolean {
  return META.test(from);
}
