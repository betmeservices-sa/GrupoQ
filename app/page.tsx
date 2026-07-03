"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquareDashed } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/roles";
import { ME } from "@/lib/data/seed";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveToggle } from "@/components/shell/LiveToggle";
import { AiModeToggle } from "@/components/shell/AiModeToggle";
import { InboxFilters, type Filtros } from "@/components/inbox/InboxFilters";
import { ConversationList, type ListaItem } from "@/components/inbox/ConversationList";
import { Thread } from "@/components/inbox/Thread";
import { ContextPanel } from "@/components/inbox/ContextPanel";
import { estadoVentana } from "@/lib/ventana";
import type { ConversationStatus, DepartmentId } from "@/lib/data/types";

const FILTROS_INICIALES: Filtros = {
  canal: "todos",
  estado: "todos",
  asignacion: "todas",
  departamento: "todos",
};

// Helper: persiste cambios de conversacion WhatsApp en la BD.
async function persistirWa(wa_from: string, payload: Record<string, string | null>) {
  try {
    await fetch("/api/wa/conversaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wa_from, ...payload }),
    });
  } catch {
    // silencioso: el dato ya esta en el store local
  }
}

export default function BandejaPage() {
  const { state, dispatch } = useStore();
  const { rol } = useRole();
  // Solo gerencia/jefatura/dirección pueden borrar y bloquear una conversación.
  const puedeBloquear = rol === "gerente_marketing" || rol === "jefe" || rol === "admin";
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [ctxOpen, setCtxOpen] = useState(false); // panel de contexto en movil
  const [aiRefresh, setAiRefresh] = useState(0); // refresca el toggle de IA por chat

  const contactoDe = useMemo(
    () => new Map(state.contacts.map((c) => [c.id, c])),
    [state.contacts],
  );

  // Ultimo mensaje por conversacion.
  const ultimoDe = useMemo(() => {
    const m = new Map<string, (typeof state.messages)[number]>();
    for (const msg of state.messages) {
      const prev = m.get(msg.conversationId);
      if (!prev || msg.ts > prev.ts) m.set(msg.conversationId, msg);
    }
    return m;
  }, [state.messages]);

  const items: ListaItem[] = useMemo(() => {
    return state.conversations
      .filter((c) => filtros.canal === "todos" || c.canal === filtros.canal)
      .filter((c) => filtros.estado === "todos" || c.estado === filtros.estado)
      .filter((c) => {
        if (filtros.asignacion === "mias") return c.asignadoA === ME;
        if (filtros.asignacion === "sin_asignar") return !c.asignadoA;
        return true;
      })
      .filter((c) => filtros.departamento === "todos" || c.departamento === filtros.departamento)
      .sort((a, b) => b.ultimoMensajeTs.localeCompare(a.ultimoMensajeTs))
      .map((conversation) => ({
        conversation,
        contact: contactoDe.get(conversation.contactId)!,
        ultimo: ultimoDe.get(conversation.id),
      }));
  }, [state.conversations, filtros, contactoDe, ultimoDe]);

  const activa = activaId ? state.conversations.find((c) => c.id === activaId) ?? null : null;
  const contactoActivo = activa ? contactoDe.get(activa.contactId)! : null;
  const mensajesActivos = useMemo(() => {
    if (!activa) return [];
    return state.messages
      .filter((m) => m.conversationId === activa.id)
      .sort((a, b) => a.ts.localeCompare(b.ts));
  }, [state.messages, activa]);

  // Ultimo mensaje del cliente (entrante) y si la ventana de 24h esta cerrada.
  const ultimoEntranteTs = useMemo(() => {
    for (let i = mensajesActivos.length - 1; i >= 0; i--) {
      if (mensajesActivos[i].autor === "cliente") return mensajesActivos[i].ts;
    }
    return undefined;
  }, [mensajesActivos]);
  const ventanaCerrada =
    activa?.canal === "whatsapp" ? estadoVentana(ultimoEntranteTs).cerrada : false;

  function seleccionar(id: string) {
    setActivaId(id);
    dispatch({ type: "MARK_READ", conversationId: id });
  }

  // "Iniciar conversación" desde la pestaña Contactos: abre (o crea) el chat.
  useEffect(() => {
    const raw = sessionStorage.getItem("ccg.iniciarConv");
    if (!raw) return;
    sessionStorage.removeItem("ccg.iniciarConv");
    try {
      const { telefono, nombre } = JSON.parse(raw) as { telefono: string; nombre?: string };
      const tel = String(telefono || "").replace(/\D/g, "");
      if (tel.length < 8) return;
      dispatch({ type: "NUEVA_CONVERSACION_WA", telefono: tel, nombre });
      setActivaId(`wac-${tel}`);
    } catch {
      // json inválido: ignorar
    }
  }, [dispatch]);

  const sinLeerTotal = state.conversations.reduce((sum, c) => sum + c.noLeidos, 0);

  return (
    <div className="flex h-full flex-col">
      {/* Top bar (se oculta en movil cuando hay una conversacion abierta) */}
      <header
        className={cn(
          "items-center justify-between border-b border-line bg-card px-5 py-3 lg:flex",
          activa ? "hidden lg:flex" : "flex",
        )}
      >
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">
            Bandeja unificada
          </h1>
          <p className="text-[12.5px] text-[#94a3b4]">
            {state.conversations.length} conversaciones · {sinLeerTotal} sin leer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AiModeToggle />
          <LiveToggle />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Columna 1: lista */}
        <section
          className={cn(
            "shrink-0 flex-col border-r border-line bg-card lg:flex lg:w-[340px]",
            activa ? "hidden" : "flex w-full",
          )}
        >
          <InboxFilters filtros={filtros} onChange={setFiltros} />
          <ConversationList items={items} activaId={activaId} onSelect={seleccionar} />
        </section>

        {/* Columna 2: hilo */}
        <section className={cn("min-w-0 flex-1 flex-col", activa ? "flex" : "hidden lg:flex")}>
          {activa && contactoActivo ? (
            <Thread
              key={activa.id}
              conversation={activa}
              aiRefresh={aiRefresh}
              ventanaCerrada={ventanaCerrada}
              contact={contactoActivo}
              messages={mensajesActivos}
              esMia={activa.asignadoA === ME}
              onBack={() => setActivaId(null)}
              onInfo={() => setCtxOpen(true)}
              onTyping={() => {
                if (activa.canal !== "whatsapp") return;
                const ultimoEntrante = [...mensajesActivos]
                  .reverse()
                  .find((m) => m.autor === "cliente");
                if (!ultimoEntrante) return;
                fetch("/api/whatsapp/typing", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ messageId: ultimoEntrante.id }),
                }).catch(() => {});
              }}
              onSend={async (texto) => {
                // WhatsApp: enviamos primero por la Cloud API; si sale bien,
                // agregamos el mensaje con el id real (asi no se duplica con lo
                // que el webhook persiste) y el endpoint lo guarda en la base.
                if (activa.canal === "whatsapp" && contactoActivo.telefono) {
                  const r = await fetch("/api/whatsapp/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ to: contactoActivo.telefono, text: texto, manual: true }),
                  });
                  const d = await r.json().catch(() => ({ ok: false }));
                  if (!d.ok) {
                    console.error("WhatsApp send fallo:", d.error);
                    throw new Error(d.error ?? "Fallo el envio");
                  }
                  dispatch({
                    type: "SEND_MESSAGE",
                    conversationId: activa.id,
                    texto,
                    staffId: ME,
                    waId: d.id,
                  });
                  // El envio manual pausa la IA en este chat: refresca el toggle.
                  setAiRefresh((n) => n + 1);
                  return;
                }
                dispatch({ type: "SEND_MESSAGE", conversationId: activa.id, texto, staffId: ME });
              }}
              onSendTemplate={
                activa.canal === "whatsapp" && contactoActivo.telefono
                  ? async ({ name, language, variables, texto }) => {
                      const r = await fetch("/api/whatsapp/send-template", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          to: contactoActivo.telefono,
                          name,
                          language,
                          variables,
                          texto,
                          manual: true,
                        }),
                      });
                      const d = await r.json().catch(() => ({ ok: false }));
                      if (!d.ok) {
                        console.error("send-template fallo:", d.error);
                        throw new Error(d.error ?? "Fallo el envio de la plantilla");
                      }
                      dispatch({
                        type: "SEND_MESSAGE",
                        conversationId: activa.id,
                        texto,
                        staffId: ME,
                        waId: d.id,
                      });
                      setAiRefresh((n) => n + 1);
                    }
                  : undefined
              }
              onReact={async (messageId, emoji) => {
                // Solo aplica a conversaciones de WhatsApp.
                if (activa.canal !== "whatsapp" || !contactoActivo.telefono) return;
                try {
                  await fetch("/api/whatsapp/react", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ to: contactoActivo.telefono, messageId, emoji }),
                  });
                } catch (err) {
                  console.error("react error:", err);
                }
              }}
              onAttach={async (file) => {
                // Solo aplica a conversaciones de WhatsApp.
                if (activa.canal !== "whatsapp" || !contactoActivo.telefono) return;
                const fd = new FormData();
                fd.append("to", contactoActivo.telefono);
                fd.append("file", file);
                fd.append("caption", "");
                try {
                  const r = await fetch("/api/whatsapp/send-media", { method: "POST", body: fd });
                  const d = await r.json().catch(() => ({ ok: false }));
                  if (d.ok) {
                    dispatch({
                      type: "SEND_MESSAGE",
                      conversationId: activa.id,
                      texto: file.type.startsWith("image/")
                        ? "[imagen enviada]"
                        : `[documento: ${file.name}]`,
                      staffId: ME,
                      waId: d.id,
                    });
                  } else {
                    console.error("send-media fallo:", d);
                  }
                } catch (err) {
                  console.error("send-media error:", err);
                }
              }}
              onAsignarme={() => {
                dispatch({ type: "ASSIGN", conversationId: activa.id, staffId: ME });
                if (activa.canal === "whatsapp" && contactoActivo.telefono) {
                  persistirWa(contactoActivo.telefono, { asignado_a: ME });
                }
              }}
              onResolver={() => {
                const nuevoEstado =
                  activa.estado === "resuelto" ? "en_progreso" : "resuelto";
                dispatch({
                  type: "SET_STATUS",
                  conversationId: activa.id,
                  estado: nuevoEstado,
                });
                if (activa.canal === "whatsapp" && contactoActivo.telefono) {
                  persistirWa(contactoActivo.telefono, { estado: nuevoEstado });
                }
              }}
              onBloquear={
                puedeBloquear && activa.canal === "whatsapp" && contactoActivo.telefono
                  ? async () => {
                      const tel = contactoActivo.telefono!;
                      const ok = window.confirm(
                        `¿Borrar y bloquear a ${contactoActivo.nombre}? Se elimina la conversación y este número no podrá volver a escribir.`,
                      );
                      if (!ok) return;
                      // Optimista: quita la conversación y cierra el hilo.
                      dispatch({ type: "ELIMINAR_CONVERSACION", conversationId: activa.id });
                      setActivaId(null);
                      try {
                        await fetch("/api/whatsapp/block", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ from: tel }),
                        });
                      } catch (err) {
                        console.error("block error:", err);
                      }
                    }
                  : undefined
              }
            />
          ) : (
            <EmptyState
              Icon={MessageSquareDashed}
              titulo="Selecciona una conversacion"
              descripcion="Elige un mensaje de la lista para ver y responder la conversacion."
            />
          )}
        </section>

        {/* Columna 3: contexto (estatica en desktop) */}
        {activa && contactoActivo && (
          <div className="hidden lg:flex">
            <ContextPanel
              conversation={activa}
              contact={contactoActivo}
              ultimoEntranteTs={ultimoEntranteTs}
              onAsignar={(staffId) => {
                dispatch({ type: "ASSIGN", conversationId: activa.id, staffId });
                if (activa.canal === "whatsapp" && contactoActivo.telefono) {
                  persistirWa(contactoActivo.telefono, { asignado_a: staffId || null });
                }
              }}
              onEstado={(estado: ConversationStatus) => {
                dispatch({ type: "SET_STATUS", conversationId: activa.id, estado });
                if (activa.canal === "whatsapp" && contactoActivo.telefono) {
                  persistirWa(contactoActivo.telefono, { estado });
                }
              }}
              onDepartamento={(departamento: DepartmentId) => {
                dispatch({ type: "SET_DEPARTMENT", conversationId: activa.id, departamento });
                if (activa.canal === "whatsapp" && contactoActivo.telefono) {
                  persistirWa(contactoActivo.telefono, { departamento });
                }
              }}
            />
          </div>
        )}
      </div>

      {/* Panel de contexto como slide-over en movil */}
      {activa && contactoActivo && ctxOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCtxOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 right-0 w-[86%] max-w-xs shadow-xl">
            <ContextPanel
              conversation={activa}
              contact={contactoActivo}
              ultimoEntranteTs={ultimoEntranteTs}
              onClose={() => setCtxOpen(false)}
              onAsignar={(staffId) => {
                dispatch({ type: "ASSIGN", conversationId: activa.id, staffId });
                if (activa.canal === "whatsapp" && contactoActivo.telefono) {
                  persistirWa(contactoActivo.telefono, { asignado_a: staffId || null });
                }
              }}
              onEstado={(estado: ConversationStatus) => {
                dispatch({ type: "SET_STATUS", conversationId: activa.id, estado });
                if (activa.canal === "whatsapp" && contactoActivo.telefono) {
                  persistirWa(contactoActivo.telefono, { estado });
                }
              }}
              onDepartamento={(departamento: DepartmentId) => {
                dispatch({ type: "SET_DEPARTMENT", conversationId: activa.id, departamento });
                if (activa.canal === "whatsapp" && contactoActivo.telefono) {
                  persistirWa(contactoActivo.telefono, { departamento });
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
