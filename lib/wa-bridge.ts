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

// Cuántos mensajes se piden por vuelta.
//
// Al abrir la bandeja hay que leer el historial entero, porque la lista de
// conversaciones se arma con él. Con seis meses importados eso son dieciséis mil
// mensajes: en páginas de cien y una por tick, la lista tardaba más de diez
// minutos en quedar completa y volvía a empezar en cada recarga. Se piden
// páginas grandes y se encadenan sin esperar hasta vaciar lo que falta.
const PAGINA_HISTORIAL = 1000;
// Ya al día, cada tick trae dos o tres mensajes: pedir de a mil sería cargar la
// consulta para nada.
const PAGINA_SONDEO = 100;
// Freno: si algo hace que el servidor devuelva siempre página llena, esto corta
// en vez de pedir para siempre. Alcanza para un cuarto de millón de mensajes.
const MAX_VUELTAS = 250;

// Puente: sondea el webhook server-side y mete los mensajes reales de WhatsApp
// en el store (como conversaciones nuevas o existentes). Corre siempre, no
// depende del toggle "en vivo" del demo.
export function useWhatsappBridge(dispatch: Dispatch<StoreAction>) {
  const cursor = useRef(0);
  const hidratado = useRef(false);
  const alDia = useRef(false);

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

    /** Una vuelta. Devuelve si el servidor dice que todavia queda historial. */
    async function traerPagina(limite: number, historico: boolean): Promise<boolean> {
      const r = await fetch(`/api/whatsapp/inbox?after=${cursor.current}&limite=${limite}`);
      if (!r.ok || !activo) return false;
      const data = (await r.json()) as { mensajes: WaInboundDTO[]; hayMas?: boolean };
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
        } else {
          // Ponerse al dia: se encadenan las paginas sin esperar el proximo
          // tick. Son unas pocas vueltas seguidas y la lista queda completa.
          let vueltas = 0;
          let quedaMas = true;
          while (quedaMas && activo && vueltas < MAX_VUELTAS) {
            quedaMas = await traerPagina(PAGINA_HISTORIAL, true);
            vueltas++;
          }
          if (!activo) return;
          alDia.current = true;
          dispatch({ type: "HISTORIAL_PENDIENTE", pendiente: false });
        }
        // Tras el primer sondeo, las conversaciones ya existen: rehidrata su estado.
        if (!hidratado.current) {
          hidratado.current = true;
          await hidratar();
        }
      } catch {
        // Silencioso: reintenta en el proximo tick. Se marca como al dia igual
        // para no reintentar el historial entero cada cuatro segundos si lo que
        // falla es la red.
        if (!alDia.current) dispatch({ type: "HISTORIAL_PENDIENTE", pendiente: false });
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
