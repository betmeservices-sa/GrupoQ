"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, Hash } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Composer } from "@/components/inbox/Composer";
import { horaDe, staffMeta } from "@/lib/format";
import { ME } from "@/lib/data/seed";
import type { InternalChannel, InternalMessage } from "@/lib/data/types";

export function InternalThread({
  channel,
  messages,
  onSend,
  onBack,
}: {
  channel: InternalChannel;
  messages: InternalMessage[];
  onSend: (texto: string) => void;
  onBack?: () => void;
}) {
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  const titulo = channel.tipo === "canal" ? `#${channel.nombre}` : channel.nombre;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-line bg-card px-4 py-3.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#5b6b80] hover:bg-surface lg:hidden"
        >
          <ChevronLeft size={22} />
        </button>
        {channel.tipo === "canal" && <Hash size={18} className="text-[#94a3b4]" />}
        <p className="text-sm font-bold text-[#0f1b2d]">{titulo}</p>
        <span className="text-[12px] text-[#94a3b4]">· {channel.miembros.length} miembros</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => {
          const meta = staffMeta(m.staffId);
          const esYo = m.staffId === ME;
          return (
            <div key={m.id} className={`flex gap-2.5 ${i === messages.length - 1 ? "ccg-pop" : ""}`}>
              <Avatar iniciales={meta.iniciales} size={34} color={meta.color} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-bold text-[#0f1b2d]">
                    {esYo ? "Tú" : meta.nombre}
                  </span>
                  <span className="text-[11px] text-[#94a3b4]">{horaDe(m.ts)}</span>
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-[#33425a]">{m.texto}</p>
              </div>
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      <Composer onSend={onSend} placeholder={`Mensaje para ${titulo}`} />
    </div>
  );
}
