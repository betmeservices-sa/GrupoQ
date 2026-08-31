// Promociones del hotel: lo que el dueño enciende en su panel es EXACTAMENTE lo
// que el agente puede ofrecer por WhatsApp.
//
// El guion del agente nunca lleva promociones escritas a mano. Lleva este
// bloque, que se arma en cada respuesta con lo que esté activo en ese momento.
// Dos consecuencias buscadas:
//   1. apagar una promo la retira de la conversación al instante, sin deploy;
//   2. si no hay ninguna activa, el bloque se lo dice al agente con todas las
//      letras, así no se inventa un descuento para cerrar la venta.
//
// Este archivo es PURO (no toca base ni red) para poder probarlo y para que lo
// pueda importar tanto la pantalla como el servidor.

// Qué clientes tienen la pestaña Promociones. Es la MISMA lista que decide si
// el bloque se le pega al guion: si el menú y el guion se separaran, el hotel
// encendería promociones que el agente nunca vería (o al revés).
export const TENANTS_CON_PROMOS: readonly string[] = ["yaly"];

export function usaPromos(tenant: string): boolean {
  return TENANTS_CON_PROMOS.includes(tenant);
}

export interface Promocion {
  id: string;
  tenant: string;
  nombre: string;
  descripcion: string;
  /** Texto libre: "$99 la noche", "2x1 de lunes a jueves", "15% menos". */
  precio: string;
  /** Lo que NO cubre. Es el campo que evita reclamos en recepción. */
  restricciones: string;
  /** AAAA-MM-DD. Vacío = sin fecha de corte. */
  desde?: string;
  hasta?: string;
  activa: boolean;
  actualizada: string; // ISO 8601
}

export type PromocionNueva = Omit<Promocion, "id" | "actualizada" | "tenant">;

/** Vigente = encendida y dentro de sus fechas (si declaró fechas). */
export function estaVigente(p: Promocion, hoy: string): boolean {
  if (!p.activa) return false;
  if (p.desde && hoy < p.desde) return false;
  if (p.hasta && hoy > p.hasta) return false;
  return true;
}

export function promocionesVigentes(promos: Promocion[], hoy: string): Promocion[] {
  return promos.filter((p) => estaVigente(p, hoy));
}

function linea(p: Promocion): string {
  const partes = [`"${p.nombre}": ${p.descripcion}`, `Precio: ${p.precio}.`];
  if (p.restricciones.trim()) partes.push(`Restricciones: ${p.restricciones}.`);
  if (p.hasta) partes.push(`Válida hasta el ${p.hasta}.`);
  return partes.join(" ");
}

/**
 * El bloque que se le pega al guion del agente. Se arma en cada respuesta, así
 * que refleja el panel en vivo.
 */
export function bloquePromociones(promos: Promocion[], hoy: string): string {
  const vigentes = promocionesVigentes(promos, hoy);
  if (vigentes.length === 0) {
    return `\n\nPROMOCIONES ACTIVAS: ninguna en este momento. NO ofrezcas, insinúes ni inventes promociones, descuentos, paquetes ni cortesías. Si el huésped pregunta si hay alguna, dile con naturalidad que ahora mismo no tenemos promociones vigentes y sigue con la tarifa normal.`;
  }
  const lista = vigentes.map((p, i) => `${i + 1}. ${linea(p)}`).join("\n");
  return `\n\nPROMOCIONES ACTIVAS (el hotel las enciende y las apaga desde su panel; esta lista es la ÚNICA que puedes ofrecer):\n${lista}\n\nReglas de las promociones: menciona como máximo UNA por mensaje y solo cuando venga al caso. CUÉNTALA en dos o tres líneas y cierra con una pregunta; no pegues el texto completo, que en el teléfono no se lee. El precio va EXACTO tal como está escrito arriba, sin redondear ni mejorar la oferta, y la restricción que le aplique a ese huésped se dice; las demás, solo si pregunta. Si el huésped pide una promoción que no está en esta lista, dile que esa no está vigente. Nunca las combines entre sí salvo que una lo diga.`;
}
