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
}

// Puente: sondea el inbox server-side y mete los mensajes reales de Messenger
// e Instagram en el store (como conversaciones nuevas o existentes). Mismo
// patrón que el puente de WhatsApp (wa-bridge): corre siempre, no depende del
// toggle "en vivo" del demo.
export function useMetaBridge(dispatch: Dispatch<StoreAction>) {
  const cursor = useRef(0);

  // Sondeo continuo cada 4s.
  useEffect(() => {
    let activo = true;

    async function sondear() {
      try {
        const r = await fetch(`/api/meta/inbox?after=${cursor.current}`);
        if (!r.ok || !activo) return;
        const data = (await r.json()) as { mensajes: MetaMensajeDTO[] };
        for (const m of data.mensajes) {
          dispatch({
            type: "META_INCOMING",
            mid: m.mid,
            canal: m.canal,
            pageId: m.pageId,
            senderId: m.senderId,
            senderName: m.senderName,
            texto: m.texto,
            ts: m.ts,
            direction: m.direction,
          });
          if (m.seq > cursor.current) cursor.current = m.seq;
        }
      } catch {
        // silencioso: reintenta en el proximo tick
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
