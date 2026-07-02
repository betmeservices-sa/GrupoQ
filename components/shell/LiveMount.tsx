"use client";

import { useStore } from "@/lib/store";
import { useLive } from "@/lib/live-context";
import { useLiveEngine } from "@/lib/data/live-engine";
import { useWhatsappBridge } from "@/lib/wa-bridge";

// Punto único donde corre el motor en vivo, dentro de los providers.
export function LiveMount() {
  const { dispatch } = useStore();
  const { enabled } = useLive();
  useLiveEngine(dispatch, enabled); // mensajes simulados (toggle del demo)
  useWhatsappBridge(dispatch); // mensajes reales de WhatsApp (siempre)
  return null;
}
