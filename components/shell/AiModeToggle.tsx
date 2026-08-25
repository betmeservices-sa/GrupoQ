"use client";

import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/cn";
import { useRole } from "@/lib/roles";

// Interruptor del Modo IA (always-on). Lee y escribe el estado global en el
// servidor, así la IA responde aunque nadie tenga el dashboard abierto.
//
// NO lo ve todo el mundo. Apagarlo o encenderlo cambia el comportamiento del
// agente para TODAS las conversaciones del cliente, no solo las de quien lo
// toca. Quien atiende mensajes tiene el interruptor de su propio chat, que es
// el que le corresponde; este es de dirección.
export function AiModeToggle() {
  const { def } = useRole();
  const puedeVerlo = def.ve.includes("settings");
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/ai/config")
      .then((r) => r.json())
      .then((d) => setEnabled(Boolean(d.enabled)))
      .catch(() => setEnabled(false));
  }, []);

  async function toggle() {
    if (enabled === null) return;
    const nuevo = !enabled;
    setEnabled(nuevo);
    await fetch("/api/ai/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: nuevo }),
    }).catch(() => setEnabled(!nuevo));
  }

  const on = enabled === true;

  if (!puedeVerlo) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={enabled === null}
      aria-pressed={on}
      title={on ? "La IA responde automáticamente" : "La IA está apagada"}
      className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition disabled:opacity-50",
        on
          ? "border-emerald-200 bg-emerald-50 text-[#2f9e2f]"
          : "border-line bg-card text-[var(--text-2)] hover:border-[var(--border-2)]",
      )}
    >
      <Bot size={15} />
      <span>Modo IA</span>
      <span
        className={cn(
          "relative inline-flex h-4 w-7 items-center rounded-full transition",
          on ? "bg-[#2f9e2f]" : "bg-[var(--border-2)]",
        )}
      >
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-full bg-card shadow transition",
            on ? "translate-x-3.5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
