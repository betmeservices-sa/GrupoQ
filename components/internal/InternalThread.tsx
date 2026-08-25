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

  // Sin el "#" adelante: al lado ya va el icono de almohadilla, y juntos se
  // leian como "# #membresias".
  const titulo = channel.nombre;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-surface">
      <div className="flex items-center gap-2 border-b border-line bg-card px-4 py-3.5">
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-2)] hover:bg-surface lg:hidden"
        >
          <ChevronLeft size={22} />
        </button>
        {channel.tipo === "canal" && <Hash size={18} className="text-[var(--text-3)]" />}
        <p className="text-sm font-bold text-[var(--text)]">{titulo}</p>
        {/* Sin el punto separador delante del numero: "· 6 miembros" se leia
            como "16 miembros". */}
        <span className="ml-1 text-[12px] text-[var(--text-3)]">
          {channel.miembros.length} {channel.miembros.length === 1 ? "miembro" : "miembros"}
        </span>
      </div>

      {/* min-h-0: sin esto el alto minimo de un item flex es el de su contenido,
          asi que la lista de mensajes se niega a encoger y empuja la caja de
          escribir fuera de la pantalla. */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => {
          const meta = staffMeta(m.staffId);
          const esYo = m.staffId === ME;
          return (
            <div key={m.id} className={`flex gap-2.5 ${i === messages.length - 1 ? "ccg-pop" : ""}`}>
              <Avatar iniciales={meta.iniciales} size={34} color={meta.color} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-bold text-[var(--text)]">
                    {esYo ? "Tú" : meta.nombre}
                  </span>
                  <span className="text-[11px] text-[var(--text-3)]">{horaDe(m.ts)}</span>
                </div>
                <p className="mt-0.5 text-sm leading-relaxed text-[var(--text-2)]">{m.texto}</p>
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
