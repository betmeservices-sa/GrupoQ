// Formularios de onboarding: qué cliente puede enviar y cómo se guarda.
//
// La lista de clientes es cerrada a propósito. La ruta que los recibe es
// pública (la llama el sitio de miagentia.com, que no tiene sesión), así que sin
// esto cualquiera podría llenar la tabla inventando nombres de cliente.

export const CLIENTES = ["yali", "hospital", "grupoq", "excel"] as const;
export type ClienteOnboarding = (typeof CLIENTES)[number];

export function esCliente(x: unknown): x is ClienteOnboarding {
  return typeof x === "string" && (CLIENTES as readonly string[]).includes(x);
}

export interface EnvioOnboarding {
  id: string;
  cliente: string;
  respuestas: Record<string, string | string[]>;
  pendientes: number;
  origen?: string;
  creado: string;
}

/** Tope de tamaño del envío. Un formulario largo no llega ni a 20 KB. */
export const LIMITE_BYTES = 120_000;

/**
 * Limpia lo que llega de afuera.
 *
 * Se descarta lo que no sea texto o lista de textos, y se recorta cada valor:
 * la ruta es pública y no hay razón para guardar un campo de medio megabyte.
 */
export function limpiar(datos: unknown): Record<string, string | string[]> {
  if (!datos || typeof datos !== "object") return {};
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of Object.entries(datos as Record<string, unknown>)) {
    const clave = String(k).slice(0, 120).trim();
    if (!clave) continue;
    if (typeof v === "string") {
      const t = v.trim().slice(0, 4000);
      if (t) out[clave] = t;
    } else if (Array.isArray(v)) {
      const lista = v
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim().slice(0, 300))
        .filter(Boolean)
        .slice(0, 40);
      if (lista.length) out[clave] = lista;
    }
  }
  return out;
}
