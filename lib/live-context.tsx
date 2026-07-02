"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface LiveContextValue {
  enabled: boolean;
  toggle: () => void;
}

const LiveContext = createContext<LiveContextValue | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  // Apagado por defecto: el demo ya no inyecta mensajes simulados, solo entran
  // los reales de WhatsApp. El usuario puede encenderlo con el toggle si quiere.
  const [enabled, setEnabled] = useState(false);
  return (
    <LiveContext.Provider value={{ enabled, toggle: () => setEnabled((v) => !v) }}>
      {children}
    </LiveContext.Provider>
  );
}

export function useLive(): LiveContextValue {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive debe usarse dentro de <LiveProvider>");
  return ctx;
}
