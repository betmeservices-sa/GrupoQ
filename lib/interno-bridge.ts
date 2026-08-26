"use client";

// Trae el chat interno del servidor y lo mantiene al día.
//
// Sondea cada 4 segundos, igual que los puentes de WhatsApp y de Meta. Sin esto
// el chat interno era una ilusión: cada navegador escribía en su propia copia y
// el mensaje no llegaba nunca al otro lado.
//
// El cursor va por id de mensaje, no por fecha: dos mensajes del mismo segundo
// se pisarían y uno se perdería.

import { useCallback, useEffect, useRef, useState } from "react";
import type { CanalInterno, MensajeInterno } from "./interno-store";

export interface EstadoInterno {
  /** Mi ficha dentro del equipo. Con ella se sabe cuáles mensajes son míos. */
  yo: string;
  canales: CanalInterno[];
  mensajes: MensajeInterno[];
  /** Hasta qué mensaje llegué en cada canal. De acá sale el punto rojo. */
  leido: Record<string, number>;
  /** true = no hay base y el chat no entrega nada. Se avisa en pantalla. */
  enMemoria: boolean;
  cargando: boolean;
}

const VACIO: EstadoInterno = {
  yo: "me",
  canales: [],
  mensajes: [],
  leido: {},
  enMemoria: false,
  cargando: true,
};

export function useInterno() {
  const [estado, setEstado] = useState<EstadoInterno>(VACIO);
  const cursor = useRef(0);

  const sondear = useCallback(async () => {
    try {
      const r = await fetch(`/api/interno?after=${cursor.current}`);
      if (!r.ok) return;
      const d = (await r.json()) as {
        yo?: string;
        canales?: CanalInterno[];
        mensajes?: MensajeInterno[];
        leido?: Record<string, number>;
        enMemoria?: boolean;
      };
      setEstado((prev) => {
        const nuevos = d.mensajes ?? [];
        for (const m of nuevos) if (m.id > cursor.current) cursor.current = m.id;
        return {
          yo: d.yo ?? prev.yo,
          canales: d.canales ?? prev.canales,
          // Se acumulan: el servidor solo manda lo que falta desde el cursor.
          mensajes: nuevos.length ? [...prev.mensajes, ...nuevos] : prev.mensajes,
          leido: d.leido ?? prev.leido,
          enMemoria: Boolean(d.enMemoria),
          cargando: false,
        };
      });
    } catch {
      // Silencioso: reintenta en el próximo tick.
    }
  }, []);

  useEffect(() => {
    void sondear();
    const h = window.setInterval(sondear, 4000);
    return () => window.clearInterval(h);
  }, [sondear]);

  const enviar = useCallback(
    async (canalId: string, texto: string, imagen?: string) => {
      await fetch("/api/interno", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accion: "mensaje", canalId, texto, imagen }),
      });
      await sondear();
    },
    [sondear],
  );

  const marcarLeido = useCallback(async (canalId: string, ultimoId: number) => {
    setEstado((p) => ({ ...p, leido: { ...p.leido, [canalId]: ultimoId } }));
    await fetch("/api/interno", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ accion: "leido", canalId, ultimoId }),
    });
  }, []);

  const guardarCanal = useCallback(
    async (canal: Partial<CanalInterno>) => {
      const r = await fetch("/api/interno", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accion: "canal", canal }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      await sondear();
      return d;
    },
    [sondear],
  );

  return { estado, enviar, marcarLeido, guardarCanal, refrescar: sondear };
}

/** Cuántos mensajes sin leer hay en cada canal. */
export function sinLeerPorCanal(e: EstadoInterno): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of e.mensajes) {
    // Los propios nunca cuentan como sin leer.
    if (m.autor === e.yo) continue;
    if (m.id > (e.leido[m.canalId] ?? 0)) out[m.canalId] = (out[m.canalId] ?? 0) + 1;
  }
  return out;
}
