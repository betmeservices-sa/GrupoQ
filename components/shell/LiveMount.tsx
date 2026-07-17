"use client";

import { useStore } from "@/lib/store";
import { useLive } from "@/lib/live-context";
import { useLiveEngine } from "@/lib/data/live-engine";
import { useWhatsappBridge } from "@/lib/wa-bridge";
import { useMetaBridge } from "@/lib/meta-bridge";

// Punto único donde corre el motor en vivo, dentro de los providers.
export function LiveMount() {
  const { dispatch } = useStore();
  const { enabled } = useLive();
  useLiveEngine(dispatch, enabled); // mensajes simulados (toggle del demo)
  useWhatsappBridge(dispatch); // mensajes reales de WhatsApp (siempre)
  useMetaBridge(dispatch); // mensajes reales de Messenger e Instagram (siempre)
  return null;
}
