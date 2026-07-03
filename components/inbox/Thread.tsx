"use client";

import { useEffect, useRef } from "react";
import { Ban, Check, ChevronLeft, Info, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { depto } from "@/lib/format";
import { Avatar, inicialesDe } from "@/components/ui/Avatar";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { MessageBubble } from "./MessageBubble";
import { Composer, type EnvioPlantilla } from "./Composer";
import { ConversationAiToggle } from "./ConversationAiToggle";
import type { Contact, Conversation, Message } from "@/lib/data/types";

export function Thread({
  conversation,
  contact,
  messages,
  esMia,
  onSend,
  onAsignarme,
  onResolver,
  onBloquear,
  onBack,
  onInfo,
  onTyping,
  onReact,
  onAttach,
  onSendTemplate,
  aiRefresh,
  ventanaCerrada,
}: {
  conversation: Conversation;
  contact: Contact;
  messages: Message[];
  esMia: boolean;
  onSend: (texto: string) => void | Promise<void>;
  onAsignarme: () => void;
  onResolver: () => void;
  onBloquear?: () => void; // solo lo pasan roles gerente/jefe/direccion
  onBack?: () => void;
  onInfo?: () => void;
  onTyping?: () => void;
  onReact?: (messageId: string, emoji: string) => void;
  onAttach?: (file: File) => void | Promise<void>;
  onSendTemplate?: (t: EnvioPlantilla) => void | Promise<void>;
  aiRefresh?: number;
  ventanaCerrada?: boolean;
}) {
  const finRef = useRef<HTMLDivElement>(null);
  const d = depto(conversation.departamento);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex h-full min-w-0 flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between gap-6 border-b border-line bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#5b6b80] hover:bg-surface lg:hidden"
          >
            <ChevronLeft size={22} />
          </button>
          <Avatar iniciales={inicialesDe(contact.nombre)} size={40} color={d.color} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#0f1b2d]">{contact.nombre}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <ChannelBadge channel={conversation.canal} showLabel />
              <span className="text-[11px] text-[#94a3b4]">·</span>
              <span className="text-[11px] font-medium" style={{ color: d.color }}>
                {d.nombre}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <ConversationAiToggle
            from={contact.telefono}
            visible={conversation.canal === "whatsapp"}
            refreshKey={aiRefresh}
          />
          {!esMia && (
            <button
              type="button"
              onClick={onAsignarme}
              aria-label="Asignarme"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] font-semibold text-[#5b6b80] transition hover:border-brand hover:text-brand sm:px-2.5"
            >
              <UserPlus size={15} />
              <span className="hidden sm:inline">Asignarme</span>
            </button>
          )}
          <button
            type="button"
            onClick={onResolver}
            aria-label="Resolver"
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold transition sm:px-2.5",
              conversation.estado === "resuelto"
                ? "bg-emerald-50 text-[#2f9e2f]"
                : "bg-brand text-white hover:bg-brand-dark",
            )}
          >
            <Check size={15} />
            <span className="hidden sm:inline">
              {conversation.estado === "resuelto" ? "Resuelta" : "Resolver"}
            </span>
          </button>
          {onBloquear && conversation.canal === "whatsapp" && (
            <button
              type="button"
              onClick={onBloquear}
              aria-label="Borrar y bloquear"
              title="Borrar y bloquear esta conversación"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-white px-2 py-1.5 text-[12.5px] font-semibold text-[#5b6b80] transition hover:border-[#a32923] hover:bg-red-50 hover:text-[#a32923] sm:px-2.5"
            >
              <Ban size={15} />
              <span className="hidden sm:inline">Bloquear</span>
            </button>
          )}
          <button
            type="button"
            onClick={onInfo}
            aria-label="Informacion del cliente"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5b6b80] hover:bg-surface lg:hidden"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m, i) => (
          <MessageBubble
            key={m.id}
            message={m}
            isNew={i === messages.length - 1}
            onReact={onReact}
          />
        ))}
        <div ref={finRef} />
      </div>

      <Composer
        onSend={onSend}
        onTyping={onTyping}
        onAttach={onAttach}
        onSendTemplate={onSendTemplate}
        ventanaCerrada={ventanaCerrada}
      />
    </div>
  );
}
