"use client";

import { useEffect, useState } from "react";
import { Bot } from "lucide-react";
import { cn } from "@/lib/cn";

// Override de la IA para UNA conversacion. Es independiente del interruptor
// global: puedes encender la IA en un chat aunque el "Modo IA" global este
// apagado, o apagarla en un chat aunque el global este encendido.
export function ConversationAiToggle({
  from,
  visible,
  refreshKey = 0,
}: {
  from?: string;
  visible: boolean;
  refreshKey?: number;
}) {
  const [activa, setActiva] = useState<boolean | null>(null);

  useEffect(() => {
    if (!visible || !from) {
      setActiva(null);
      return;
    }
    let on = true;
    fetch(`/api/ai/conversacion?from=${encodeURIComponent(from)}`)
      .then((r) => r.json())
      .then((d) => {
        if (on) setActiva(Boolean(d.activa));
      })
      .catch(() => {
        if (on) setActiva(false);
      });
    return () => {
      on = false;
    };
  }, [from, visible, refreshKey]);

  if (!visible || !from || activa === null) return null;

  async function toggle() {
    const nuevo = !activa;
    setActiva(nuevo);
    try {
      await fetch("/api/ai/conversacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, activa: nuevo }),
      });
    } catch {
      setActiva(!nuevo);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={activa}
      title={
        activa
          ? "La IA responde este chat. Toca para tomarlo tú."
          : "Tú llevas este chat. Toca para que lo responda la IA."
      }
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition",
        activa
          ? "border-emerald-200 bg-emerald-50 text-[#2f9e2f]"
          : "border-line bg-white text-[#5b6b80] hover:border-[#cdd5df]",
      )}
    >
      <Bot size={13} />
      <span className="hidden md:inline">IA {activa ? "activa" : "en pausa"}</span>
      <span
        className={cn(
          "relative inline-flex h-3.5 w-6 items-center rounded-full transition",
          activa ? "bg-[#2f9e2f]" : "bg-[#cdd5df]",
        )}
      >
        <span
          className={cn(
            "inline-block h-2.5 w-2.5 rounded-full bg-white shadow transition",
            activa ? "translate-x-3" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
