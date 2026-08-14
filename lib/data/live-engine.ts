"use client";

import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { StoreAction } from "../store";
import { activeTenant } from "../tenants/active";
import type { CanalExterno, TenantSimulacion } from "../tenants/types";
import type { Channel, DepartmentId } from "./types";

// Motor de "vida" de la bandeja: con el interruptor encendido entran mensajes
// simulados por varios canales y el agente contesta solo. Todo ocurre en el
// navegador y sale del guion del tenant activo; no toca WhatsApp real ni el
// modelo. Apagado, no hace absolutamente nada.

// Ritmo pensado para grabar: un mensaje cada 5 a 9 segundos, con variación para
// que no se sienta un metrónomo.
export const PASO_MIN_MS = 5000;
export const PASO_MAX_MS = 9000;
// El primer mensaje entra rápido, para que se note al encender el interruptor.
export const ARRANQUE_MS = 1800;
// La respuesta no es instantánea: primero se ve "escribiendo", luego el texto.
export const ESCRIBIENDO_MS = 1300;
export const RESPUESTA_MIN_MS = 3400;
export const RESPUESTA_MAX_MS = 6200;

// Una de cada cuatro veces entra alguien que no estaba en la bandeja.
const CADA_CUANTAS_NUEVAS = 4;
const TURNO_NUEVA = 2; // resto del tick que abre conversación

// Prefijo de las conversaciones que crea la simulación. Sirve de frontera: las
// reales (wac- de WhatsApp, metac- de Messenger/Instagram) nunca se tocan.
export const SIM_PREFIJO = "sim-";

const CANALES: CanalExterno[] = ["whatsapp", "facebook", "instagram"];

export interface ConversacionViva {
  id: string;
  canal: Channel;
}

export interface PasoSimulado {
  conversationId: string;
  texto: string;
  respuesta: string;
  // Presente solo cuando el paso estrena conversación.
  nueva?: {
    canal: CanalExterno;
    nombre: string;
    telefono?: string;
    handle?: string;
    departamento?: DepartmentId;
  };
}

function esSimulable(c: ConversacionViva): boolean {
  return (
    c.canal !== "internal" &&
    !c.id.startsWith("wac-") &&
    !c.id.startsWith("metac-")
  );
}

// Decide qué pasa en este tick: a qué conversación entra el mensaje, con qué
// texto y con qué respuesta. Puro, para poder probarlo sin relojes.
export function siguientePaso({
  tick,
  simulacion,
  conversaciones,
  azar = Math.random,
}: {
  tick: number;
  simulacion: TenantSimulacion;
  conversaciones: ConversacionViva[];
  azar?: () => number;
}): PasoSimulado | null {
  const { turnos, contactos } = simulacion;
  if (turnos.length === 0) return null;
  const turno = turnos[tick % turnos.length];

  const elegibles = conversaciones.filter(esSimulable);
  const abrirNueva =
    contactos.length > 0 &&
    (elegibles.length === 0 || tick % CADA_CUANTAS_NUEVAS === TURNO_NUEVA);

  if (abrirNueva) {
    // Cuántas abrió ya la simulación: sirve de índice y de número de hilo.
    const abiertas = conversaciones.filter((c) => c.id.startsWith(SIM_PREFIJO)).length;
    const contacto = contactos[abiertas % contactos.length];
    return {
      conversationId: `${SIM_PREFIJO}${abiertas + 1}`,
      texto: turno.entra,
      respuesta: turno.responde,
      nueva: {
        canal: contacto.canal,
        nombre: contacto.nombre,
        telefono: contacto.telefono,
        handle: contacto.handle,
        departamento: contacto.departamento,
      },
    };
  }

  // Rota el canal para que la bandeja se mueva por los tres, no siempre por uno.
  const canalDeseado = CANALES[tick % CANALES.length];
  const porCanal = elegibles.filter((c) => c.canal === canalDeseado);
  const candidatos = porCanal.length > 0 ? porCanal : elegibles;
  const elegida = candidatos[Math.min(candidatos.length - 1, Math.floor(azar() * candidatos.length))];

  return {
    conversationId: elegida.id,
    texto: turno.entra,
    respuesta: turno.responde,
  };
}

function entre(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function useLiveEngine(
  dispatch: Dispatch<StoreAction>,
  enabled: boolean,
  conversaciones: ConversacionViva[],
) {
  const tick = useRef(0);
  // Las conversaciones cambian con cada mensaje; van por ref para que el motor
  // vea siempre las últimas sin reiniciar los tiempos.
  const convRef = useRef(conversaciones);
  convRef.current = conversaciones;

  useEffect(() => {
    if (!enabled) return;

    let vivo = true;
    const timers = new Set<number>();
    const escribiendo = new Set<string>();

    function luego(fn: () => void, ms: number) {
      const h = window.setTimeout(() => {
        timers.delete(h);
        if (vivo) fn();
      }, ms);
      timers.add(h);
    }

    function paso() {
      const p = siguientePaso({
        tick: tick.current++,
        simulacion: activeTenant().simulacion,
        conversaciones: convRef.current,
      });

      if (p) {
        dispatch({
          type: "INCOMING",
          conversationId: p.conversationId,
          texto: p.texto,
          nueva: p.nueva,
        });
        luego(() => {
          escribiendo.add(p.conversationId);
          dispatch({ type: "ESCRIBIENDO", conversationId: p.conversationId, activo: true });
        }, ESCRIBIENDO_MS);
        luego(() => {
          escribiendo.delete(p.conversationId);
          dispatch({ type: "RESPUESTA_IA", conversationId: p.conversationId, texto: p.respuesta });
        }, entre(RESPUESTA_MIN_MS, RESPUESTA_MAX_MS));
      }

      luego(paso, entre(PASO_MIN_MS, PASO_MAX_MS));
    }

    luego(paso, ARRANQUE_MS);

    return () => {
      vivo = false;
      timers.forEach((h) => window.clearTimeout(h));
      // Al apagar, ningún hilo se queda con el "escribiendo" pegado.
      escribiendo.forEach((id) =>
        dispatch({ type: "ESCRIBIENDO", conversationId: id, activo: false }),
      );
    };
  }, [dispatch, enabled]);
}
