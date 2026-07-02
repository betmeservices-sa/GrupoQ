"use client";

import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/cn";

// Interruptor del Modo IA (always-on). Lee y escribe el estado global en el
// servidor, así la IA responde aunque nadie tenga el dashboard abierto.
export function AiModeToggle() {
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
          : "border-line bg-white text-[#5b6b80] hover:border-[#cdd5df]",
      )}
    >
      <Bot size={15} />
      <span>Modo IA</span>
      <span
        className={cn(
          "relative inline-flex h-4 w-7 items-center rounded-full transition",
          on ? "bg-[#2f9e2f]" : "bg-[#cdd5df]",
        )}
      >
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-full bg-white shadow transition",
            on ? "translate-x-3.5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
