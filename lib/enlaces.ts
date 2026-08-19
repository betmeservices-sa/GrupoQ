// Links rastreables para las bios y las publicaciones.
//
// ── POR QUÉ NO ALCANZA CON UN wa.me PELADO ──
// A un `wa.me` se le puede pegar `?utm_source=instagram` y no sirve de nada:
// WhatsApp solo reenvía el parámetro `text`, y al negocio le llega el mensaje
// sin ningún rastro de dónde salió el clic. (Lo que en un CRM se ve como UTM
// viene del navegador, de una landing o un formulario, no de WhatsApp.)
//
// ── CÓMO SE RESUELVE ──
// En la bio NO va el wa.me, va un link nuestro: `/ir/<codigo>?utm_...`. Ese
// link hace dos cosas antes de soltar al huésped en WhatsApp:
//   1. REGISTRA EL CLIC con sus UTMs (lib/clics-store.ts). De ahí salen los
//      clics por perfil y por campaña, que es lo que no se podía medir.
//   2. REDIRIGE al wa.me con el mensaje ya escrito, y ese mensaje dice de qué
//      perfil y de qué hotel viene. Esa frase es la que une el clic con la
//      conversación: es lo único que WhatsApp sí deja pasar.
// Con eso queda la cadena completa: clic (con UTM) -> mensaje -> conversación.
//
// El otro camino, para anuncios, sigue siendo el `referral` de Meta, que es
// exacto y no necesita nada de esto (ver lib/origen-sede.ts).

import type { SucursalTenant, TenantSucursales } from "./tenants/types";

export type CanalEnlace = "Instagram" | "Facebook" | "Sitio web";

export interface EnlaceRastreado {
  /** Va en la URL: /ir/<codigo>. Estable, es la llave con la que se agrupan los clics. */
  codigo: string;
  sedeId: string;
  sedeNombre: string;
  canal: CanalEnlace;
  /** Mensaje que queda escrito en WhatsApp. Es lo que identifica el origen. */
  frase: string;
  /** UTMs con los que se registra el clic. */
  utm: { source: string; medium: string; campaign: string };
}

const CANALES: { canal: CanalEnlace; slug: string; source: string; medium: string }[] = [
  { canal: "Instagram", slug: "ig", source: "instagram", medium: "bio" },
  { canal: "Facebook", slug: "fb", source: "facebook", medium: "bio" },
  { canal: "Sitio web", slug: "web", source: "sitio-web", medium: "boton" },
];

// Trozo corto y estable del nombre de la sede para el código del link.
function slugSede(sede: SucursalTenant): string {
  return sede.nombre
    .split(",")[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * La frase la lee después el webhook para saber de dónde viene el contacto, así
 * que incluye el nombre COMPLETO de la sede (con su playa): así también la caza
 * el comparador de alias si el huésped la edita a medias.
 */
export function fraseDeEnlace(sede: SucursalTenant, canal: CanalEnlace): string {
  return `Hola, vengo del ${canal} de ${sede.nombre}`;
}

/** Los links de todas las sedes por todos los canales. */
export function enlacesDe(sucursales?: TenantSucursales): EnlaceRastreado[] {
  if (!sucursales) return [];
  return sucursales.opciones.flatMap((sede) =>
    CANALES.map(({ canal, slug, source, medium }) => ({
      codigo: `${slugSede(sede)}-${slug}`,
      sedeId: sede.id,
      sedeNombre: sede.nombre,
      canal,
      frase: fraseDeEnlace(sede, canal),
      utm: { source, medium, campaign: slugSede(sede) },
    })),
  );
}

export function enlacePorCodigo(
  codigo: string,
  sucursales?: TenantSucursales,
): EnlaceRastreado | null {
  return enlacesDe(sucursales).find((e) => e.codigo === codigo) ?? null;
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Qué link generó este mensaje, si es que fue alguno. Se compara la frase
 * completa: el texto llega tal cual lo dejó el link, así que la coincidencia es
 * exacta. Si el huésped lo editó, esto devuelve null y arriba se cae al
 * comparador de alias, que con reconocer la sede ya sirve.
 */
export function enlaceDeTexto(
  texto: string,
  sucursales?: TenantSucursales,
): EnlaceRastreado | null {
  const t = normalizar(texto);
  if (!t) return null;
  return enlacesDe(sucursales).find((e) => t.includes(normalizar(e.frase))) ?? null;
}

/**
 * El link que va en la bio, con sus UTMs. `base` es el dominio del panel.
 * Pide lo mínimo (código y UTMs) para que la pantalla se lo pueda pasar sin
 * arrastrar el resto del enlace.
 */
export function urlDeEnlace(
  base: string,
  e: Pick<EnlaceRastreado, "codigo" | "utm">,
): string {
  const qs = new URLSearchParams({
    utm_source: e.utm.source,
    utm_medium: e.utm.medium,
    utm_campaign: e.utm.campaign,
  });
  return `${base.replace(/\/$/, "")}/ir/${e.codigo}?${qs}`;
}

/** A dónde manda el link una vez registrado el clic. */
export function destinoWhatsApp(numero: string, e: EnlaceRastreado): string {
  return `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(e.frase)}`;
}
