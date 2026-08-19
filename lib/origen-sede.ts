// De qué hotel viene el contacto, SIN preguntárselo.
//
// ── EL PROBLEMA ──
// Yali tiene tres perfiles de Instagram (uno por hotel) pero un solo WhatsApp.
// Cuando alguien toca "Enviar mensaje" desde la bio, WhatsApp NO le dice al
// negocio de qué perfil salió: llega un número y ya. Por eso el agente abre
// preguntando a cuál sede escribe.
//
// ── LO QUE SÍ SE PUEDE ──
// 1. LINK RASTREABLE PROPIO (funciona hoy, sin API, sin pauta). En la bio de
//    cada perfil va un link nuestro que registra el clic con sus UTMs y recién
//    después manda a WhatsApp con el mensaje escrito, y ese mensaje dice de qué
//    perfil y de qué hotel viene (ver lib/enlaces.ts). El huésped solo aprieta
//    enviar. Si borra el texto, caemos en la pregunta de siempre: no se pierde
//    nada.
// 2. REFERRAL DE ANUNCIO (exacto, pero solo con pauta). Si el clic viene de un
//    anuncio de click to WhatsApp, Meta manda un bloque `referral` en el
//    webhook con el id del anuncio, su titular y su cuerpo. Ahí la sede se
//    deduce con certeza.
// 3. UN NÚMERO POR HOTEL (lo único 100% infalible). El webhook ya sabe enrutar
//    por `phone_number_id`; falta que el hotel tenga tres números.
//
// Este archivo cubre 1 y 2. La 3 es una decisión del cliente, no código.

import { interpretarSucursal } from "./sucursal-gate";
import { enlaceDeTexto, type EnlaceRastreado } from "./enlaces";
import type { SucursalTenant, TenantSucursales } from "./tenants/types";

/** Bloque `referral` de WhatsApp Cloud API (solo llega en clics desde anuncios). */
export interface ReferralWa {
  source_id?: string;
  source_url?: string;
  source_type?: string;
  headline?: string;
  body?: string;
  ctwa_clid?: string;
}

export interface OrigenContacto {
  sede: SucursalTenant;
  /** El link rastreable que lo trajo, si vino por uno. Con él se une al clic. */
  enlace: EnlaceRastreado | null;
  /** Cómo se supo: por el anuncio, por el link de la bio o por lo que escribió. */
  via: "anuncio" | "enlace" | "texto";
}

/**
 * De dónde viene el contacto, o null si no se puede saber (ahí sí toca
 * preguntar). El orden va de lo más confiable a lo menos: el anuncio es dato de
 * Meta, el link es texto que pusimos nosotros, y lo que escribió el huésped
 * puede ser cualquier cosa.
 */
export function origenDelContacto(
  entrada: { texto?: string; referral?: ReferralWa | null },
  sucursales?: TenantSucursales,
): OrigenContacto | null {
  if (!sucursales) return null;

  const r = entrada.referral;
  if (r) {
    // El titular y el cuerpo del anuncio nombran el hotel; la URL suele traer
    // el slug de su página. Se prueban en ese orden, del más explícito al menos.
    for (const campo of [r.headline, r.body, urlLegible(r.source_url)]) {
      if (!campo) continue;
      const sede = interpretarSucursal(campo, sucursales);
      if (sede) return { sede, enlace: null, via: "anuncio" };
    }
  }

  if (entrada.texto) {
    // Primero el link: reconoce la frase completa, así que además del hotel dice
    // de qué perfil salió y con eso se engancha el clic y su UTM.
    const enlace = enlaceDeTexto(entrada.texto, sucursales);
    if (enlace) {
      const sede = sucursales.opciones.find((o) => o.id === enlace.sedeId);
      if (sede) return { sede, enlace, via: "enlace" };
    }
    const sede = interpretarSucursal(entrada.texto, sucursales);
    if (sede) return { sede, enlace: null, via: "texto" };
  }
  return null;
}

/** Solo la sede, para quien no necesita el resto. */
export function sedeDeOrigen(
  entrada: { texto?: string; referral?: ReferralWa | null },
  sucursales?: TenantSucursales,
): SucursalTenant | null {
  return origenDelContacto(entrada, sucursales)?.sede ?? null;
}

// "https://www.yalihospitality.com/costa-del-surf" -> "costa del surf", para que
// el mismo comparador de alias pueda leerla.
function urlLegible(url?: string): string {
  if (!url) return "";
  try {
    return decodeURIComponent(new URL(url).pathname).replace(/[-_/]+/g, " ").trim();
  } catch {
    return url.replace(/[-_/]+/g, " ");
  }
}
