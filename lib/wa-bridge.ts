"use client";

import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { StoreAction } from "./store";

interface WaInboundDTO {
  seq: number;
  waId: string;
  from: string;
  nombre?: string;
  texto: string;
  ts: string;
  direccion?: "in" | "out";
  media?: { id: string; tipo: string; mime?: string; filename?: string };
}

interface ConversacionDTO {
  wa_from: string;
  asignado_a?: string | null;
  estado?: string | null;
  departamento?: string | null;
}

// Puente: sondea el webhook server-side y mete los mensajes reales de WhatsApp
// en el store (como conversaciones nuevas o existentes). Corre siempre, no
// depende del toggle "en vivo" del demo.
export function useWhatsappBridge(dispatch: Dispatch<StoreAction>) {
  const cursor = useRef(0);
  const hidratado = useRef(false);

  // Sondeo continuo cada 4s.
  useEffect(() => {
    let activo = true;

    // Hidratacion: carga asignado/estado/departamento persistidos. Se llama una
    // sola vez, despues del primer sondeo exitoso (cuando ya existen las
    // conversaciones), evitando la carrera de un timer fijo.
    async function hidratar() {
      try {
        const r = await fetch("/api/wa/conversaciones");
        if (!r.ok || !activo) return;
        const data = (await r.json()) as { conversaciones: ConversacionDTO[] };
        for (const row of data.conversaciones) {
          dispatch({
            type: "HIDRATAR_CONVERSACION",
            wa_from: row.wa_from,
            asignado_a: row.asignado_a ?? null,
            estado: row.estado ?? null,
            departamento: row.departamento ?? null,
          });
        }
      } catch {
        // silencioso
      }
    }

    async function sondear() {
      try {
        const r = await fetch(`/api/whatsapp/inbox?after=${cursor.current}`);
        if (!r.ok || !activo) return;
        const data = (await r.json()) as { mensajes: WaInboundDTO[] };
        for (const m of data.mensajes) {
          dispatch({
            type: "WHATSAPP_INCOMING",
            waId: m.waId,
            from: m.from,
            nombre: m.nombre,
            texto: m.texto,
            ts: m.ts,
            direccion: m.direccion,
            media: m.media,
          });
          if (m.seq > cursor.current) cursor.current = m.seq;
        }
        // Tras el primer sondeo, las conversaciones ya existen: rehidrata su estado.
        if (!hidratado.current) {
          hidratado.current = true;
          await hidratar();
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
