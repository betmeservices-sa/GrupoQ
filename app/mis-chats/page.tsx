"use client";

import { useRouter } from "next/navigation";
import { BotOff, Inbox, MessageSquare, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import { ME, staff } from "@/lib/data/seed";
import { activeTenant } from "@/lib/tenants/active";
import type { Conversation } from "@/lib/data/types";

// Los chats que el agente me pasó a mí.
//
// La regla es una sola y vale para toda la app: un chat con dueño NO lo contesta
// la IA. Por eso esta pantalla no tiene un interruptor de "apagar la IA": el
// interruptor es la asignación. Sofía pasa el chat cuando el huésped pide una
// persona, cuando la conversación llega a su tope de mensajes o cuando no logra
// identificar el hotel; en el servidor eso ya apaga la IA para ese número
// (lib/ai-reply.ts llama a setChatOverride en el handoff).
export default function MisChatsPage() {
  const { state, dispatch } = useStore();
  const router = useRouter();
  const tenant = activeTenant();
  const yo = staff.find((s) => s.id === ME);

  const mios = state.conversations
    .filter((c) => c.asignadoA === ME)
    .sort((a, b) => (a.ultimoMensajeTs < b.ultimoMensajeTs ? 1 : -1));

  const nombreSede = (id?: string) =>
    tenant.sucursales?.opciones.find((o) => o.id === id)?.nombre.split(",")[0] ?? null;

  const nombreContacto = (contactId: string) =>
    state.contacts.find((c) => c.id === contactId)?.nombre ?? "Contacto";

  const ultimoMensaje = (conversationId: string) => {
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].conversationId === conversationId) return state.messages[i].texto;
    }
    return null;
  };

  function abrir(c: Conversation) {
    sessionStorage.setItem("ccg.abrirConv", c.id);
    router.push("/");
  }

  function devolver(c: Conversation) {
    dispatch({ type: "ASSIGN", conversationId: c.id, staffId: null });
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-5 py-3">
        <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Mis chats</h1>
        <p className="text-[12.5px] text-[var(--text-3)]">
          Las conversaciones que Sofía te pasó a vos{yo ? `, ${yo.nombre}` : ""}
        </p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <p className="flex items-start gap-2.5 rounded-xl border border-line bg-card px-4 py-3 text-[12.5px] leading-relaxed text-[var(--text-2)]">
          <BotOff size={16} className="mt-0.5 shrink-0 text-brand" />
          Cuando un chat es tuyo, la IA se apaga en ese chat y no vuelve a escribir. Sofía te lo
          pasa cuando el huésped pide hablar con una persona, cuando la conversación se alarga o
          cuando hay algo que ella no puede confirmar.
        </p>

        {mios.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-2)] bg-card p-8 text-center">
            <Inbox size={26} className="mx-auto text-[var(--text-3)]" />
            <p className="mt-3 text-[13.5px] font-bold text-[var(--text)]">
              No tenés chats asignados
            </p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-[var(--text-3)]">
              Sofía está atendiendo todo. Acá van a aparecer los que te pase.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {mios.map((c) => {
              const sede = nombreSede(c.sucursalId);
              const ultimo = ultimoMensaje(c.id);
              return (
                <li
                  key={c.id}
                  className="rounded-2xl border border-line bg-card p-4 shadow-sm transition hover:border-brand/45"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <p className="text-[14px] font-bold text-[var(--text)]">
                      {nombreContacto(c.contactId)}
                    </p>
                    {sede && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                        {sede}
                      </span>
                    )}
                    <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold capitalize text-[var(--text-2)]">
                      {c.canal}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--text-3)]">
                      <BotOff size={12} />
                      IA apagada
                    </span>
                    {c.noLeidos > 0 && (
                      <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
                        {c.noLeidos} sin leer
                      </span>
                    )}
                  </div>

                  {ultimo && (
                    <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-[var(--text-2)]">
                      {ultimo}
                    </p>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => abrir(c)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-[12.5px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110"
                    >
                      <MessageSquare size={13} />
                      Abrir en la bandeja
                    </button>
                    <button
                      type="button"
                      onClick={() => devolver(c)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2",
                        "text-[12.5px] font-semibold text-[var(--text-2)] transition hover:bg-surface",
                      )}
                    >
                      <Undo2 size={13} />
                      Devolver a Sofía
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
