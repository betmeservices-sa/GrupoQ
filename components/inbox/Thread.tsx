"use client";

import { Fragment, useEffect, useLayoutEffect, useRef  } from "react";
import { Ban, Check, ChevronLeft, Info, Loader2, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { depto } from "@/lib/format";
import { Avatar, inicialesDe } from "@/components/ui/Avatar";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { MessageBubble } from "./MessageBubble";
import { claveDeDia, diaDelHilo } from "@/lib/format";
import { Composer, type EnvioPlantilla } from "./Composer";
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
  emojis,
  onAttach,
  onSendTemplate,
  ventanaCerrada,
  escribiendo,
  hayAnteriores,
  cargandoAnteriores,
  onCargarAnteriores,
}: {
  conversation: Conversation;
  contact: Contact;
  messages: Message[];
  esMia: boolean;
  escribiendo?: boolean;
  onSend: (texto: string) => void | Promise<void>;
  onAsignarme: () => void;
  onResolver: () => void;
  onBloquear?: () => void; // solo lo pasan roles gerente/jefe/direccion
  onBack?: () => void;
  onInfo?: () => void;
  onTyping?: () => void;
  onReact?: (messageId: string, emoji: string) => void;
  /** Los emojis que se ofrecen para reaccionar; por defecto, todos. */
  emojis?: string[];
  onAttach?: (file: File) => void | Promise<void>;
  onSendTemplate?: (t: EnvioPlantilla) => void | Promise<void>;
  ventanaCerrada?: boolean;
  /** Quedan mensajes mas viejos en la base que todavia no se trajeron. */
  hayAnteriores?: boolean;
  cargandoAnteriores?: boolean;
  onCargarAnteriores?: () => void;
}) {
  const finRef = useRef<HTMLDivElement>(null);
  const listaRef = useRef<HTMLDivElement>(null);
  const d = depto(conversation.departamento);

  // Al fondo cuando llega un mensaje NUEVO, no cuando se cargan viejos arriba.
  // Antes miraba la cantidad, y cargar cincuenta anteriores mandaba la vista
  // al fondo: justo lo contrario de lo que se queria ver.
  const ultimoId = messages[messages.length - 1]?.id;
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [ultimoId, escribiendo]);

  // Al cargar mensajes viejos arriba, la vista se queda donde estaba: se mide
  // cuanto crecio la lista y se corre el scroll esa misma cantidad. Sin esto,
  // el navegador deja el scroll en el mismo pixel y lo que se estaba leyendo
  // se va cincuenta mensajes para abajo.
  const altoAntes = useRef(0);
  const primerId = messages[0]?.id;
  useLayoutEffect(() => {
    const el = listaRef.current;
    if (!el) return;
    if (altoAntes.current > 0 && el.scrollHeight > altoAntes.current) {
      el.scrollTop += el.scrollHeight - altoAntes.current;
    }
    altoAntes.current = 0;
  }, [primerId]);

  function pedirAnteriores() {
    if (listaRef.current) altoAntes.current = listaRef.current.scrollHeight;
    onCargarAnteriores?.();
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-line bg-card px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver"
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--text-2)] hover:bg-surface lg:hidden"
          >
            <ChevronLeft size={22} />
          </button>
          <Avatar iniciales={inicialesDe(contact.nombre)} size={40} color={d.color} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[var(--text)]">{contact.nombre}</p>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <ChannelBadge channel={conversation.canal} showLabel />
              <span className="shrink-0 text-[11px] text-[var(--text-3)]">·</span>
              <span className="truncate text-[11px] font-medium" style={{ color: d.color }}>
                {d.nombre}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* El interruptor de IA por chat vive en la tarjeta del contacto
              (ContextPanel). Acá se le encimaba al nombre y al canal: son cinco
              controles peleando por el mismo renglón, y el nombre del cliente
              pierde siempre. */}
          {!esMia && (
            <button
              type="button"
              onClick={onAsignarme}
              aria-label="Asignarme"
              className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2 py-1.5 text-[12.5px] font-semibold text-[var(--text-2)] transition hover:border-brand hover:text-brand sm:px-2.5"
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
              className="flex items-center gap-1.5 rounded-lg border border-line bg-card px-2 py-1.5 text-[12.5px] font-semibold text-[var(--text-2)] transition hover:border-[#a32923] hover:bg-red-50 hover:text-[#a32923] sm:px-2.5"
            >
              <Ban size={15} />
            </button>
          )}
          <button
            type="button"
            onClick={onInfo}
            aria-label="Informacion del cliente"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-2)] hover:bg-surface lg:hidden"
          >
            <Info size={18} />
          </button>
        </div>
      </div>

      {/* Mensajes */}
      {/* min-h-0: sin esto el hilo se niega a encoger y empuja el composer
          fuera de la pantalla en monitores bajos. */}
      <div ref={listaRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {hayAnteriores && (
          <div className="flex justify-center pb-1">
            <button
              type="button"
              onClick={pedirAnteriores}
              disabled={cargandoAnteriores}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-[12px] font-semibold text-[var(--text-2)] hover:border-brand hover:text-brand disabled:opacity-60"
            >
              {cargandoAnteriores && <Loader2 size={12} className="animate-spin" />}
              {cargandoAnteriores ? "Trayendo" : "Ver mensajes anteriores"}
            </button>
          </div>
        )}
        {messages.map((m, i) => (
          <Fragment key={m.id}>
            {/* Solo se veía la hora: entre un "11:49 a.m." y un "9:18 a.m." no
                se sabía si pasó un día o una semana. Cuando cambia el día, va
                la fecha en medio, como en WhatsApp. */}
            {(i === 0 || claveDeDia(m.ts) !== claveDeDia(messages[i - 1].ts)) && (
              <div className="my-2 flex justify-center">
                <span className="rounded-full bg-surface px-3 py-1 text-[11px] font-semibold text-[var(--text-3)] ring-1 ring-line">
                  {diaDelHilo(m.ts)}
                </span>
              </div>
            )}
            <MessageBubble
              message={m}
              isNew={i === messages.length - 1}
              onReact={onReact}
              emojis={emojis}
            />
          </Fragment>
        ))}
        {escribiendo && (
          <div className="ccg-pop flex flex-col items-end">
            <div className="flex items-center gap-1 rounded-2xl rounded-br-sm bg-brand/85 px-3.5 py-3 shadow-sm">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="ccg-punto h-1.5 w-1.5 rounded-full bg-white"
                  style={{ animationDelay: `${i * 0.16}s` }}
                />
              ))}
            </div>
            <span className="mt-1 px-1 text-[10.5px] text-[var(--text-3)]">
              Asistente IA escribiendo
            </span>
          </div>
        )}
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
