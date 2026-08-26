"use client";

import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { StoreAction } from "./store";

interface MetaMensajeDTO {
  seq: number;
  mid: string;
  canal: "facebook" | "instagram";
  pageId: string;
  senderId: string;
  senderName?: string;
  texto: string;
  ts: string;
  direction?: "in" | "out";
  historiaUrl?: string;
}

// Puente: sondea el inbox server-side y mete los mensajes reales de Messenger
// e Instagram en el store (como conversaciones nuevas o existentes). Mismo
// patrón que el puente de WhatsApp (wa-bridge): corre siempre, no depende del
// toggle "en vivo" del demo.
// Mismos numeros y mismo motivo que en el puente de WhatsApp: la bandeja se
// arma releyendo todo, y tras importar el historial de Facebook eso son miles
// de mensajes que en paginas de cien tardarian minutos en aparecer.
const PAGINA_HISTORIAL = 1000;
const PAGINA_SONDEO = 100;
const MAX_VUELTAS = 250;

export function useMetaBridge(dispatch: Dispatch<StoreAction>) {
  const cursor = useRef(0);
  const alDia = useRef(false);

  // Sondeo continuo cada 4s.
  useEffect(() => {
    let activo = true;

    /** Una vuelta. Devuelve si el servidor dice que todavia queda historial. */
    async function traerPagina(limite: number, historico: boolean): Promise<boolean> {
      const r = await fetch(`/api/meta/inbox?after=${cursor.current}&limite=${limite}`);
      if (!r.ok || !activo) return false;
      const data = (await r.json()) as {
        mensajes: MetaMensajeDTO[];
        paginas?: Record<string, string>;
        hayMas?: boolean;
      };
      for (const m of data.mensajes) {
        dispatch({
          type: "META_INCOMING",
          mid: m.mid,
          canal: m.canal,
          pageId: m.pageId,
          paginaNombre: data.paginas?.[m.pageId],
          senderId: m.senderId,
          senderName: m.senderName,
          texto: m.texto,
          ts: m.ts,
          direction: m.direction,
          historiaUrl: m.historiaUrl,
          historico,
        });
        if (m.seq > cursor.current) cursor.current = m.seq;
      }
      return Boolean(data.hayMas);
    }

    async function sondear() {
      try {
        if (alDia.current) {
          await traerPagina(PAGINA_SONDEO, false);
          return;
        }
        let vueltas = 0;
        let quedaMas = true;
        while (quedaMas && activo && vueltas < MAX_VUELTAS) {
          quedaMas = await traerPagina(PAGINA_HISTORIAL, true);
          vueltas++;
        }
        if (activo) alDia.current = true;
      } catch {
        // Silencioso: reintenta en el proximo tick. Se da por al dia igual,
        // para no reintentar el historial entero cada cuatro segundos.
        alDia.current = true;
      }
    }

    const handle = window.setInterval(sondear, 4000);
    sondear();
    return () => {
      activo = false;
      window.clearInterval(handle);
    };
  }, [dispatch]);
}
