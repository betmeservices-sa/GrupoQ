import { UserCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { diaRelativo, depto, inicialesStaff, nombreStaff } from "@/lib/format";
import { Avatar, inicialesDe } from "@/components/ui/Avatar";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import type { Contact, Conversation, Message } from "@/lib/data/types";

export function ConversationListItem({
  conversation,
  contact,
  ultimo,
  activa,
  escribiendo,
  onClick,
}: {
  conversation: Conversation;
  contact: Contact;
  ultimo?: Message;
  activa: boolean;
  escribiendo?: boolean;
  onClick: () => void;
}) {
  const d = depto(conversation.departamento);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full gap-3 border-b border-line/70 px-3.5 py-3 text-left transition",
        activa ? "bg-brand/5" : "hover:bg-surface",
      )}
    >
      <div className="relative">
        <Avatar iniciales={inicialesDe(contact.nombre)} size={42} color={d.color} />
        <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-card p-0.5">
          <ChannelBadge channel={conversation.canal} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-[var(--text)]">{contact.nombre}</p>
          <span className="shrink-0 text-[11px] text-[var(--text-3)]">
            {diaRelativo(conversation.ultimoMensajeTs)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          {escribiendo ? (
            <p className="truncate text-[13px] font-medium text-brand">escribiendo…</p>
          ) : (
            <p className="truncate text-[13px] text-[var(--text-2)]">
              {ultimo ? ultimo.texto : "Sin mensajes"}
            </p>
          )}
          {conversation.noLeidos > 0 && (
            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand-accent)] px-1.5 text-[11px] font-bold text-white">
              {conversation.noLeidos}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          {/* Sin etiqueta mientras nadie clasifico la conversacion. Poner una
              por defecto es peor que no poner ninguna: se lee como si alguien
              hubiera decidido que era eso. */}
          {conversation.departamento !== "sin_clasificar" && (
            <span
              className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
              style={{ backgroundColor: `${d.color}1a`, color: d.color }}
            >
              {d.nombre}
            </span>
          )}
          {conversation.estado === "nuevo" && (
            <span className="rounded-md bg-[var(--brand-accent-soft)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-accent)]">
              Nuevo
            </span>
          )}
          {/* Por cual pagina entro. Con dos marcas conectadas, contestar sin
              saber a cual le escribieron es adivinar. */}
          {conversation.paginaNombre && (
            <span
              title={`Escribio a ${conversation.paginaNombre}`}
              className="max-w-[9rem] truncate rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-2)]"
            >
              {conversation.paginaNombre}
            </span>
          )}
          {conversation.asignadoA && (
            <span
              title={`Asignado a ${nombreStaff(conversation.asignadoA)}`}
              className="ml-auto flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-2)]"
            >
              <UserCheck size={11} />
              {inicialesStaff(conversation.asignadoA)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
