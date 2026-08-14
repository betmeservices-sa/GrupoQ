// De dónde entran las conversaciones: conteo por canal, participación y cuántas
// de ese canal siguen esperando atención.
//
// Función pura sobre las conversaciones que ya están en el store (semilla +
// simulación en vivo + mensajes reales). No conoce el tenant: los canales que
// no traen conversaciones simplemente no salen en el resultado, así que cada
// cliente ve solo los suyos.

import type { Channel, Conversation } from "./data/types";

export interface OrigenCanal {
  canal: Channel;
  total: number;
  /** Participación sobre el total de conversaciones, 0..100 redondeado. */
  pct: number;
  /** Conversaciones que no están resueltas. */
  sinResolver: number;
  /** Conversaciones sin nadie a cargo. */
  sinAsignar: number;
  /** Las que siguen abiertas o sin dueño: lo que falta atender de ese canal. */
  pendientes: number;
}

export function origenPorCanal(conversations: Conversation[]): OrigenCanal[] {
  const total = conversations.length;
  if (total === 0) return [];

  const porCanal = new Map<Channel, OrigenCanal>();

  for (const c of conversations) {
    let fila = porCanal.get(c.canal);
    if (!fila) {
      fila = { canal: c.canal, total: 0, pct: 0, sinResolver: 0, sinAsignar: 0, pendientes: 0 };
      porCanal.set(c.canal, fila);
    }
    const abierta = c.estado !== "resuelto";
    const huerfana = !c.asignadoA;
    fila.total += 1;
    if (abierta) fila.sinResolver += 1;
    if (huerfana) fila.sinAsignar += 1;
    if (abierta || huerfana) fila.pendientes += 1;
  }

  return [...porCanal.values()]
    .map((f) => ({ ...f, pct: Math.round((f.total / total) * 100) }))
    // Manda el volumen. Con el mismo volumen sube el que tiene más gente
    // esperando; el último desempate es alfabético para que el orden no dependa
    // de en qué momento entró cada conversación.
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.pendientes - a.pendientes ||
        a.canal.localeCompare(b.canal),
    );
}
