// Los requisitos de una solicitud de crédito de CrediQ, y en qué va cada quien.
//
// DÓNDE VIVE ESTO. En las etiquetas del contacto, con prefijo "doc:". No en una
// columna nueva: `tags` ya es un arreglo de texto, ya se guarda, ya se fusiona
// sin pisar lo que puso el staff, y ya viaja a la ficha y al pipeline. Una
// columna nueva obligaría a una migración en la base de producción para
// modelar seis casillas.
//
// El prefijo es lo que las mantiene separadas de las etiquetas de etapa
// ("Pre-aprobado", "Aprobado"): la ficha muestra unas como checklist y las
// otras como estado, y ninguna se cuela en el selector de la otra.

export interface Requisito {
  /** Va dentro de la etiqueta: "doc:salario". Nunca cambia; es la llave. */
  id: string;
  /** Como se le dice a la persona, en la ficha y en voz. */
  nombre: string;
  /** Como lo pide Sofía por teléfono o por chat, en lenguaje de la calle. */
  comoSePide: string;
  /**
   * Qué tiene que aparecer en el documento para darlo por bueno. Lo usa la
   * revisión de la foto: sin esto, "verificar" seria una corazonada.
   */
  queDebeDecir: string;
}

export const REQUISITOS: Requisito[] = [
  {
    id: "dui",
    nombre: "DUI",
    comoSePide: "una foto de su DUI por los dos lados",
    queDebeDecir: "el nombre completo y el número de DUI de la persona",
  },
  {
    id: "salario",
    nombre: "Constancia de salario",
    comoSePide: "la constancia de salario que le da su trabajo",
    queDebeDecir:
      "el nombre de la persona, el nombre de la empresa donde trabaja y el monto del salario",
  },
  {
    id: "recibo",
    nombre: "Recibo de agua o luz",
    comoSePide: "un recibo de agua o de luz reciente, para confirmar dónde vive",
    queDebeDecir: "una dirección y el nombre del titular del servicio",
  },
  {
    id: "referencias",
    nombre: "Referencias personales",
    comoSePide: "dos referencias personales, con nombre y teléfono",
    queDebeDecir: "dos nombres con sus teléfonos",
  },
];

const PREFIJO = "doc:";

/** La etiqueta que representa un requisito entregado. */
export function etiquetaDe(id: string): string {
  return `${PREFIJO}${id}`;
}

/** true si esa etiqueta es de checklist y no de etapa. */
export function esEtiquetaDeDocumento(tag: string): boolean {
  return tag.startsWith(PREFIJO);
}

export interface EstadoRequisito extends Requisito {
  entregado: boolean;
}

/** El checklist de una persona, en el orden en que se piden. */
export function checklistDe(tags: string[] | null | undefined): EstadoRequisito[] {
  const puestas = new Set((tags ?? []).filter(esEtiquetaDeDocumento));
  return REQUISITOS.map((r) => ({ ...r, entregado: puestas.has(etiquetaDe(r.id)) }));
}

/** Lo que todavía falta. Es lo que Sofía tiene que pedir, y nada más. */
export function faltantes(tags: string[] | null | undefined): EstadoRequisito[] {
  return checklistDe(tags).filter((r) => !r.entregado);
}

export function estanTodos(tags: string[] | null | undefined): boolean {
  return faltantes(tags).length === 0;
}

/**
 * Cómo se le enumeran a alguien, en una frase que se pueda decir en voz alta.
 * "el DUI, la constancia de salario y un recibo de agua o luz".
 */
export function enumerar(items: { comoSePide: string }[]): string {
  const t = items.map((i) => i.comoSePide);
  if (t.length === 0) return "";
  if (t.length === 1) return t[0];
  return `${t.slice(0, -1).join(", ")} y ${t[t.length - 1]}`;
}

/** El requisito que corresponde a un id, si existe. */
export function requisitoPorId(id: string): Requisito | undefined {
  return REQUISITOS.find((r) => r.id === id);
}
