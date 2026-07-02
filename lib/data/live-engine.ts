"use client";

import { useEffect, useRef } from "react";
import type { Dispatch } from "react";
import type { StoreAction } from "../store";

// Conversaciones que reciben mensajes simulados, y un pool de textos creíbles.
const TARGETS = ["v1", "v2", "v3", "v5"];

const POOL = [
  "Buenos días, disculpe la molestia, ¿siempre está disponible la cita?",
  "Gracias por la información, ¿aceptan tarjeta?",
  "Una consulta más, ¿a qué hora abren mañana?",
  "Perfecto, ahí estaré. Muchas gracias.",
  "¿Necesito llevar algún documento o mi DUI nada más?",
  "Hola, ¿todavía hay cupo para esta semana?",
  "Ok, quedo atenta a su respuesta. Bendiciones.",
  "¿La Frontier la tienen en color gris?",
  "Buenas, ¿atienden los sábados también?",
  "Me podría confirmar el precio inicial por favor.",
];

const INTERVAL_MS = 14000;

// Motor de "vida": cada cierto intervalo inyecta un mensaje entrante a una
// conversación, para que la bandeja se sienta activa durante la demo.
export function useLiveEngine(dispatch: Dispatch<StoreAction>, enabled: boolean) {
  const tick = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const handle = window.setInterval(() => {
      const i = tick.current++;
      const conversationId = TARGETS[i % TARGETS.length];
      const texto = POOL[i % POOL.length];
      dispatch({ type: "INCOMING", conversationId, texto });
    }, INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [dispatch, enabled]);
}
