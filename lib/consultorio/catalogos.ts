// Los otros dos catálogos: imagenología y procedimientos.
//
// El de exámenes sale de la lista del laboratorio (examenes.ts). Estos dos NO:
// la lista que mandó el cliente es solo de laboratorio, así que acá va lo que
// se hace en una clínica de este tamaño, con precios ESTIMADOS y marcados como
// tales. Se cambian cuando llegue la lista de imágenes y la de procedimientos.
//
// Comparten forma con el catálogo de exámenes a propósito: así la misma
// pantalla sirve para los tres y no hay tres formas de marcar una casilla.

import { AREAS as AREAS_EXAMENES, EXAMENES, type AreaExamenes, type Examen } from "./examenes";
import { AREAS_IMAGEN } from "./imagenes";

export { AREAS_IMAGEN };

/** De qué lado va un estudio que lo pide. */
export type Lado = "der" | "izq" | "ambos";

export const LADOS: { id: Lado; texto: string }[] = [
  { id: "der", texto: "Der" },
  { id: "izq", texto: "Izq" },
  { id: "ambos", texto: "Ambos" },
];

/** Cómo se lee un estudio con su lado: "Rodilla (der)". */
export function conLado(id: string, lados?: Record<string, Lado>): string {
  const nombre = TODOS[id]?.nombre ?? id;
  const l = lados?.[id];
  return l ? `${nombre} (${l === "ambos" ? "ambos" : l})` : nombre;
}

export type TipoOrden = "orden" | "imagen" | "proceso";

export const AREAS_PROCESO: AreaExamenes[] = [
  {
    id: "curaciones",
    nombre: "Curaciones y heridas",
    examenes: [
      { id: "p101", codigo: "PR101", nombre: "Curación simple", precio: 15, estimado: true },
      { id: "p102", codigo: "PR102", nombre: "Curación compleja", precio: 30, estimado: true },
      { id: "p103", codigo: "PR103", nombre: "Sutura de herida (hasta 5 puntos)", precio: 45, estimado: true },
      { id: "p104", codigo: "PR104", nombre: "Retiro de puntos", precio: 12, estimado: true },
      { id: "p105", codigo: "PR105", nombre: "Drenaje de absceso", precio: 55, estimado: true },
      { id: "p106", codigo: "PR106", nombre: "Extracción de cuerpo extraño", precio: 40, estimado: true },
    ],
  },
  {
    id: "consultorio",
    nombre: "En el consultorio",
    examenes: [
      { id: "p201", codigo: "PR201", nombre: "Inyección intramuscular", precio: 6, estimado: true },
      { id: "p202", codigo: "PR202", nombre: "Canalización y suero", precio: 35, estimado: true },
      { id: "p203", codigo: "PR203", nombre: "Nebulización", precio: 12, estimado: true },
      { id: "p204", codigo: "PR204", nombre: "Lavado de oídos", precio: 25, estimado: true },
      { id: "p205", codigo: "PR205", nombre: "Aplicación de vacuna", precio: 10, estimado: true },
      { id: "p206", codigo: "PR206", nombre: "Control de signos vitales", precio: 5, estimado: true },
    ],
  },
  {
    id: "ginecologia",
    nombre: "Ginecología",
    examenes: [
      {
        id: "p301",
        codigo: "PR301",
        nombre: "Papanicolaou (citología)",
        precio: 25,
        estimado: true,
        nota: "No tener relaciones ni usar óvulos las 48 horas antes. No estar menstruando",
      },
      { id: "p302", codigo: "PR302", nombre: "Colposcopía", precio: 60, estimado: true },
      { id: "p303", codigo: "PR303", nombre: "Colocación de DIU", precio: 90, estimado: true },
      { id: "p304", codigo: "PR304", nombre: "Retiro de DIU", precio: 45, estimado: true },
    ],
  },
  {
    id: "menores",
    nombre: "Cirugía menor",
    examenes: [
      { id: "p401", codigo: "PR401", nombre: "Biopsia de piel", precio: 85, estimado: true },
      { id: "p402", codigo: "PR402", nombre: "Crioterapia de lesión", precio: 55, estimado: true },
      { id: "p403", codigo: "PR403", nombre: "Extirpación de lunar o verruga", precio: 75, estimado: true },
      { id: "p404", codigo: "PR404", nombre: "Infiltración articular", precio: 70, estimado: true },
      { id: "p405", codigo: "PR405", nombre: "Uñero (onicectomía parcial)", precio: 65, estimado: true },
    ],
  },
];

/** Con cuál lista se trabaja cada tipo de orden. */
export function areasDe(tipo: TipoOrden): AreaExamenes[] {
  return tipo === "imagen" ? AREAS_IMAGEN : tipo === "proceso" ? AREAS_PROCESO : AREAS_EXAMENES;
}

/** Todo junto, para resolver un id sin saber de cuál catálogo salió. */
export const TODOS: Record<string, Examen & { area: string }> = {
  ...EXAMENES,
  ...Object.fromEntries(
    [...AREAS_IMAGEN, ...AREAS_PROCESO].flatMap((a) =>
      a.examenes.map((e) => [e.id, { ...e, area: a.nombre }]),
    ),
  ),
};

export function itemDe(id: string): (Examen & { area: string }) | undefined {
  return TODOS[id];
}

/** Si ese id existe en el catálogo del tipo que dice ser. */
export function esDe(tipo: TipoOrden, id: string): boolean {
  return areasDe(tipo).some((a) => a.examenes.some((e) => e.id === id));
}

/** Agrupa por área, dentro del catálogo que toca. */
export function agruparDe(tipo: TipoOrden, ids: string[]): { area: string; examenes: Examen[] }[] {
  return areasDe(tipo)
    .map((a) => ({ area: a.nombre, examenes: a.examenes.filter((e) => ids.includes(e.id)) }))
    .filter((g) => g.examenes.length > 0);
}

/** Lo que suman, vengan del catálogo que vengan. */
export function valorTotal(ids: string[]): number {
  return Math.round(ids.reduce((n, id) => n + (TODOS[id]?.precio ?? 0), 0) * 100) / 100;
}

/** Cómo se llama cada cosa en pantalla. */
export const NOMBRE_TIPO: Record<TipoOrden, string> = {
  orden: "Orden de laboratorio",
  imagen: "Orden de imagenología",
  proceso: "Indicación de procedimiento",
};

/**
 * Las indicaciones previas de una lista, venga del catálogo que venga.
 *
 * Es la misma regla del laboratorio: si hay varios ayunos manda el más largo,
 * porque mandar los dos es la forma más rápida de que alguien llegue con el
 * ayuno equivocado. Vale también para imágenes, que traen las suyas (la vejiga
 * llena del ultrasonido pélvico, la creatinina de la tomografía con contraste).
 */
export function preparacionDe(ids: string[]): string[] {
  const notas = ids.map((id) => TODOS[id]?.nota).filter((n): n is string => Boolean(n));
  const horas = notas
    .map((n) => Number((n.match(/ayuno de (\d+)/i) ?? [])[1]))
    .filter((h) => Number.isFinite(h) && h > 0);
  const otras = [...new Set(notas.filter((n) => !/ayuno de \d+/i.test(n)))];
  const ayuno = horas.length ? [`ayuno de ${Math.max(...horas)} horas`] : [];
  return [...ayuno, ...otras];
}
