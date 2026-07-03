"use client";

import { useMemo, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import { ME } from "@/lib/data/seed";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChannelList } from "@/components/internal/ChannelList";
import { InternalThread } from "@/components/internal/InternalThread";

export default function InternoPage() {
  const { state, dispatch } = useStore();
  const [activoId, setActivoId] = useState<string | null>(null);

  const canal = activoId
    ? state.internalChannels.find((c) => c.id === activoId) ?? null
    : null;

  const mensajes = useMemo(() => {
    if (!canal) return [];
    return state.internalMessages
      .filter((m) => m.channelId === canal.id)
      .sort((a, b) => a.ts.localeCompare(b.ts));
  }, [state.internalMessages, canal]);

  return (
    <div className="flex h-full flex-col">
      <header
        className={cn(
          "border-b border-line bg-card px-5 py-3 lg:block",
          canal ? "hidden lg:block" : "block",
        )}
      >
        <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Chat interno</h1>
        <p className="text-[12.5px] text-[#94a3b4]">
          Comunicación entre áreas
        </p>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Lista de canales */}
        <div className={cn("shrink-0 lg:block", canal ? "hidden lg:block" : "block w-full lg:w-auto")}>
          <ChannelList
            channels={state.internalChannels}
            activoId={activoId}
            onSelect={setActivoId}
          />
        </div>

        {/* Hilo */}
        <div className={cn("min-w-0 flex-1", canal ? "block" : "hidden lg:block")}>
          {canal ? (
            <InternalThread
              channel={canal}
              messages={mensajes}
              onBack={() => setActivoId(null)}
              onSend={(texto) =>
                dispatch({ type: "SEND_INTERNAL", channelId: canal.id, texto, staffId: ME })
              }
            />
          ) : (
            <EmptyState
              Icon={MessagesSquare}
              titulo="Selecciona un canal"
              descripcion="Elige un canal o mensaje directo para empezar a conversar."
            />
          )}
        </div>
      </div>
    </div>
  );
}
