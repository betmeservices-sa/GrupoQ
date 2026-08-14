// Reglas de la pestaña Redes: qué mide cada red y cómo se ve una publicación
// cuando ya está publicada en ella.
//
// Cada red cuenta distinto y muestra distinto: Facebook admite texto solo y
// fotos anchas, Instagram exige imagen y la recorta a 4:5 o a cuadro, y TikTok
// es vertical y se mide en vistas. Todo eso vive aquí, en funciones puras, para
// que la vista previa y las tarjetas de estadísticas lean de la misma fuente.

import type { PostEngagement, RedSocial, SocialPost, SocialStats } from "./data/types";

export const REDES: RedSocial[] = ["facebook", "instagram", "tiktok"];

export const RED_NOMBRE: Record<RedSocial, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
};

// Proporción en la que cada red muestra la imagen en el feed. La misma foto se
// ve distinta según dónde caiga, y eso es justo lo que hay que ver antes de
// publicar.
export const RATIO_RED: Record<RedSocial, string> = {
  facebook: "4 / 3",
  instagram: "4 / 5",
  tiktok: "9 / 16",
};

// Instagram deja elegir entre vertical y cuadro; las otras dos no.
export const RATIOS_INSTAGRAM = [
  { id: "4:5", ratio: "4 / 5" },
  { id: "1:1", ratio: "1 / 1" },
] as const;

// Cuántos caracteres se leen antes de que la red corte el texto.
export const CORTE_RED: Record<RedSocial, number> = {
  facebook: 260,
  instagram: 125,
  tiktok: 90,
};

// Instagram y TikTok no publican sin imagen; Facebook sí.
export function exigeImagen(red: RedSocial): boolean {
  return red !== "facebook";
}

export interface TextoCortado {
  visible: string;
  resto: string;
  cortado: boolean;
}

// Corta como cortan las redes: en el último espacio antes del límite, para no
// partir una palabra a la mitad.
export function cortarTexto(texto: string, limite: number): TextoCortado {
  if (texto.length <= limite) return { visible: texto, resto: "", cortado: false };
  const espacio = texto.lastIndexOf(" ", limite);
  const corte = espacio > limite * 0.6 ? espacio : limite;
  return {
    visible: texto.slice(0, corte).trimEnd(),
    resto: texto.slice(corte).trim(),
    cortado: true,
  };
}

export function imagenesDe(post: Pick<SocialPost, "imagenes">): string[] {
  return post.imagenes ?? [];
}

export function esCarrusel(post: Pick<SocialPost, "imagenes">): boolean {
  return imagenesDe(post).length > 1;
}

// Las fotos que ya usó el cliente, sin repetir, para elegir al armar una nueva.
export function galeriaDe(posts: SocialPost[]): string[] {
  const vistas = new Set<string>();
  const out: string[] = [];
  for (const p of posts) {
    for (const src of imagenesDe(p)) {
      if (vistas.has(src)) continue;
      vistas.add(src);
      out.push(src);
    }
  }
  return out;
}

export interface Metrica {
  clave: string;
  label: string;
  valor: number;
}

function metricas(pares: Array<[string, string, number | undefined]>): Metrica[] {
  const out: Metrica[] = [];
  for (const [clave, label, valor] of pares) {
    if (typeof valor === "number") out.push({ clave, label, valor });
  }
  return out;
}

// En TikTok manda la vista y después el me gusta; forzar el alcance de Meta
// aquí sería inventar una métrica que esa red no entrega.
export function metricasDeCuenta(s: SocialStats): Metrica[] {
  if (s.red === "tiktok") {
    // Tres y no cuatro: con una métrica más las etiquetas se cortan y la
    // tarjeta pierde el paralelo con las de Meta. En TikTok el compartido
    // pesa más que el comentario, porque es lo que empuja el alcance.
    return metricas([
      ["vistas", "Vistas", s.vistas30d],
      ["meGusta", "Me gusta", s.meGusta30d],
      ["compartidos", "Compartidos", s.compartidos30d],
    ]);
  }
  return metricas([
    ["alcance", "Alcance", s.alcance30d],
    ["vistas", "Vistas", s.vistas30d],
    ["interacciones", "Interacciones", s.interacciones30d],
  ]);
}

export function metricasDePost(e: PostEngagement, red: RedSocial): Metrica[] {
  if (red === "tiktok") {
    return metricas([
      ["vistas", "Vistas", e.vistas],
      ["meGusta", "Me gusta", e.meGusta],
      ["comentarios", "Comentarios", e.comentarios],
      ["compartidos", "Compartidos", e.compartidos],
    ]);
  }
  return metricas([
    ["alcance", "Alcance", e.alcance],
    ["meGusta", "Me gusta", e.meGusta],
    ["comentarios", "Comentarios", e.comentarios],
    ["compartidos", "Compartidos", e.compartidos],
    ["guardados", "Guardados", e.guardados],
  ]);
}

// Facebook, Instagram y TikTok, siempre en el mismo orden.
export function ordenarCuentas(stats: SocialStats[]): SocialStats[] {
  return [...stats].sort((a, b) => REDES.indexOf(a.red) - REDES.indexOf(b.red));
}

// Las cuentas del cliente ganan a lo que traiga el seed cuando la conexión está
// viva, pero una red que no se conectó (TikTok no pasa por Meta) no desaparece.
export function combinarCuentas(seed: SocialStats[], vivas: SocialStats[] | null): SocialStats[] {
  if (!vivas || vivas.length === 0) return ordenarCuentas(seed);
  const reemplazadas = new Set(vivas.map((s) => s.red));
  return ordenarCuentas([...vivas, ...seed.filter((s) => !reemplazadas.has(s.red))]);
}

export function redesDe(stats: SocialStats[]): RedSocial[] {
  return ordenarCuentas(stats).map((s) => s.red);
}

// "Facebook, Instagram y TikTok"
export function listarRedes(redes: RedSocial[]): string {
  const nombres = redes.map((r) => RED_NOMBRE[r]);
  if (nombres.length === 0) return "";
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
}

// La cuenta con la que se ve la publicación: la del cliente en esa red y, si
// todavía no la tiene, su nombre de marca.
export function cuentaDe(stats: SocialStats[], red: RedSocial, marca: string): string {
  return stats.find((s) => s.red === red)?.handle ?? marca;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function partes(iso: string) {
  const [anio, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return { anio, mes, dia, hhmm: iso.slice(11, 16) };
}

// "9 ago · 10:00", para las tarjetas de la lista.
export function fechaCorta(iso: string): string {
  const { mes, dia, hhmm } = partes(iso);
  return `${dia} ${MESES_CORTOS[mes - 1]} · ${hhmm}`;
}

// Cada red firma la publicación a su manera.
export function fechaEnRed(iso: string, red: RedSocial): string {
  const { mes, dia, hhmm } = partes(iso);
  if (red === "facebook") return `${dia} de ${MESES[mes - 1]} a las ${hhmm}`;
  if (red === "instagram") return `${dia} DE ${MESES[mes - 1].toUpperCase()}`;
  return `${dia}-${mes}`;
}
