"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquareDashed } from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import { useRole } from "@/lib/roles";
import { useYo } from "@/lib/yo";
import { SIM_PREFIJO } from "@/lib/data/live-engine";
import { EmptyState } from "@/components/ui/EmptyState";
import { LiveToggle } from "@/components/shell/LiveToggle";
import { AiModeToggle } from "@/components/shell/AiModeToggle";
import { InboxFilters, type Filtros } from "@/components/inbox/InboxFilters";
import { PaginaToggle } from "@/components/inbox/PaginaToggle";
import { usePaginasConectadas } from "@/lib/paginas-conectadas";
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

// Helper: persiste cambios de conversacion de Messenger/Instagram en la BD.
async function persistirMeta(id: string, payload: Record<string, string | null>) {
  try {
    await fetch("/api/meta/conversaciones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
  } catch {
    // silencioso: el dato ya esta en el store local
  }
}
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
  // La ficha de quien esta logueado (Veronica = s2): con eso se firma lo que
  // manda y se asigna. Un login de demo es la ficha generica del tenant.
  const yo = useYo();
  // Solo gerencia/jefatura/dirección pueden borrar y bloquear una conversación.
  const puedeBloquear = rol === "gerente_marketing" || rol === "jefe" || rol === "admin";
  const [filtros, setFiltros] = useState<Filtros>(FILTROS_INICIALES);
  // "todas" o el id de una página: la bandeja de una sola marca (su
  // Facebook y su Instagram juntos), y de ahí los filtros de siempre.
  const [pagina, setPagina] = useState<string>("todas");
  const paginasConectadas = usePaginasConectadas();
  const paginas = useMemo(() => {
    const vistas = new Map(paginasConectadas.map((p) => [p.id, p]));
    for (const c of state.conversations) {
      if (c.paginaId && !vistas.has(c.paginaId)) vistas.set(c.paginaId, { id: c.paginaId, nombre: c.paginaNombre ?? c.paginaId });
    }
    return [...vistas.values()];
  }, [paginasConectadas, state.conversations]);
  const [activaId, setActivaId] = useState<string | null>(null);
  const [ctxOpen, setCtxOpen] = useState(false); // panel de contexto en movil
  const [aiRefresh, setAiRefresh] = useState(0); // refresca el toggle de IA por chat

  // Que tiene cargado cada hilo. La lista trae solo el ultimo mensaje de cada
  // conversacion; el resto se pide al abrirla (los ultimos 50) y al subir (los
  // 50 anteriores). `completo` = ya no queda nada mas viejo en la base.
  const [hilos, setHilos] = useState<Record<string, { completo: boolean; cargando: boolean }>>({});

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

  const escribiendo = useMemo(() => new Set(state.escribiendo), [state.escribiendo]);

  const items: ListaItem[] = useMemo(() => {
    return state.conversations
      .filter((c) => pagina === "todas" || c.paginaId === pagina)
      .filter((c) => filtros.canal === "todos" || c.canal === filtros.canal)
      .filter((c) => filtros.estado === "todos" || c.estado === filtros.estado)
      .filter((c) => {
        if (filtros.asignacion === "mias") return c.asignadoA === yo;
        if (filtros.asignacion === "sin_asignar") return !c.asignadoA;
        return true;
      })
      .filter((c) => filtros.departamento === "todos" || c.departamento === filtros.departamento)
      .sort((a, b) => b.ultimoMensajeTs.localeCompare(a.ultimoMensajeTs))
      .map((conversation) => ({
        conversation,
        contact: contactoDe.get(conversation.contactId)!,
        ultimo: ultimoDe.get(conversation.id),
        escribiendo: escribiendo.has(conversation.id),
      }));
  }, [state.conversations, filtros, pagina, contactoDe, ultimoDe, escribiendo]);

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
    // Messenger e Instagram: la persona ve "Visto" al abrir su conversación,
    // igual que cuando lo abren desde el celular.
    const meta = partesMeta(id);
    if (meta) void accionMeta({ ...meta, accion: "visto" });
  }

  /**
   * Trae los mensajes anteriores a los que ya se tienen de este hilo.
   *
   * Solo para conversaciones reales (wac-, metac-): las de la simulacion y las
   * del seed viven enteras en el navegador y no hay nada que pedir.
   */
  const cargarAnteriores = useCallback(
    async (convId: string) => {
      const esWa = convId.startsWith("wac-");
      const esMeta = convId.startsWith("metac-");
      if (!esWa && !esMeta) {
        setHilos((h) => ({ ...h, [convId]: { completo: true, cargando: false } }));
        return;
      }
      setHilos((h) => ({ ...h, [convId]: { completo: h[convId]?.completo ?? false, cargando: true } }));

      // La fecha del mas viejo que ya se tiene: de ahi para atras.
      const propios = state.messages.filter((m) => m.conversationId === convId);
      const masViejo = propios.reduce<string | null>(
        (min, m) => (min === null || m.ts < min ? m.ts : min),
        null,
      );
      const antes = masViejo ? `&antes=${encodeURIComponent(masViejo)}` : "";

      try {
        let hayMas = false;
        if (esWa) {
          const from = convId.slice("wac-".length);
          const r = await fetch(`/api/whatsapp/inbox?de=${encodeURIComponent(from)}${antes}&limite=50`);
          const d = (await r.json()) as {
            mensajes: Array<{ waId: string; from: string; nombre?: string; texto: string; ts: string; direccion?: "in" | "out"; media?: { id: string; tipo: string; mime?: string; filename?: string } }>;
            hayMas: boolean;
          };
          for (const m of d.mensajes) {
            dispatch({ type: "WHATSAPP_INCOMING", waId: m.waId, from: m.from, nombre: m.nombre, texto: m.texto, ts: m.ts, direccion: m.direccion, media: m.media, historico: true });
          }
          hayMas = d.hayMas;
        } else {
          const [, canal, pageId, senderId] = convId.split("-");
          const r = await fetch(
            `/api/meta/inbox?de=${encodeURIComponent(senderId)}&pagina=${encodeURIComponent(pageId)}&canal=${canal}${antes}&limite=50`,
          );
          const d = (await r.json()) as {
            mensajes: Array<{ mid: string; canal: "facebook" | "instagram"; pageId: string; senderId: string; senderName?: string; texto: string; ts: string; direction?: "in" | "out"; historiaUrl?: string; adjuntoMiniatura?: string; adjuntoVideo?: string }>;
            hayMas: boolean;
          };
          for (const m of d.mensajes) {
            dispatch({ type: "META_INCOMING", mid: m.mid, canal: m.canal, pageId: m.pageId, senderId: m.senderId, senderName: m.senderName, texto: m.texto, ts: m.ts, direction: m.direction, historiaUrl: m.historiaUrl, adjuntoMiniatura: m.adjuntoMiniatura, adjuntoVideo: m.adjuntoVideo, historico: true });
          }
          hayMas = d.hayMas;
        }
        setHilos((h) => ({ ...h, [convId]: { completo: !hayMas, cargando: false } }));
      } catch {
        // Se deja como estaba: el boton sigue ahi para reintentar.
        setHilos((h) => ({ ...h, [convId]: { completo: h[convId]?.completo ?? false, cargando: false } }));
      }
    },
    [dispatch, state.messages],
  );

  // Al abrir un hilo por primera vez, se traen sus ultimos mensajes.
  useEffect(() => {
    if (!activaId || hilos[activaId]) return;
    void cargarAnteriores(activaId);
    // Solo cuando cambia el hilo abierto: si dependiera de cargarAnteriores
    // (que cambia con cada mensaje) pediria de nuevo en cada sondeo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activaId]);

  // "Abrir en la bandeja" desde Mis chats: la conversación ya existe, solo hay
  // que seleccionarla.
  useEffect(() => {
    const id = sessionStorage.getItem("ccg.abrirConv");
    if (!id) return;
    sessionStorage.removeItem("ccg.abrirConv");
    setActivaId(id);
    dispatch({ type: "MARK_READ", conversationId: id });
  }, [dispatch]);

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
          <p className="text-[12.5px] text-[var(--text-3)]">
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
          <PaginaToggle paginas={paginas} valor={pagina} onChange={setPagina} className="border-b border-line px-3.5 py-2.5" />
          <InboxFilters filtros={filtros} onChange={setFiltros} />
          <ConversationList
            items={items}
            activaId={activaId}
            onSelect={seleccionar}
            cargandoHistorial={state.historialPendiente}
          />
        </section>

        {/* Columna 2: hilo */}
        <section className={cn("min-w-0 flex-1 flex-col", activa ? "flex" : "hidden lg:flex")}>
          {activa && contactoActivo ? (
            <Thread
              key={activa.id}
              conversation={activa}
              ventanaCerrada={ventanaCerrada}
              contact={contactoActivo}
              messages={mensajesActivos}
              hayAnteriores={!(hilos[activa.id]?.completo ?? false)}
              cargandoAnteriores={hilos[activa.id]?.cargando ?? false}
              onCargarAnteriores={() => void cargarAnteriores(activa.id)}
              escribiendo={escribiendo.has(activa.id)}
              esMia={activa.asignadoA === yo}
              onBack={() => setActivaId(null)}
              onInfo={() => setCtxOpen(true)}
              onTyping={() => {
                const meta = partesMeta(activa.id);
                if (meta) {
                  void accionMeta({ ...meta, accion: "escribiendo" });
                  return;
                }
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
                // Conversación de la simulación: se responde solo en el store,
                // nunca sale un mensaje de verdad hacia un número inventado.
                if (activa.id.startsWith(SIM_PREFIJO)) {
                  dispatch({ type: "SEND_MESSAGE", conversationId: activa.id, texto, staffId: yo });
                  return;
                }
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
                    staffId: yo,
                    waId: d.id,
                  });
                  // El envio manual pausa la IA en este chat: refresca el toggle.
                  setAiRefresh((n) => n + 1);
                  return;
                }
                // Messenger/Instagram REAL: solo las conversaciones creadas por
                // el puente (id metac-<canal>-<pageId>-<senderId>). Las del seed
                // siguen siendo locales.
                if (
                  (activa.canal === "facebook" || activa.canal === "instagram") &&
                  activa.id.startsWith("metac-")
                ) {
                  const [, canal, pageId, recipientId] = activa.id.split("-");
                  const r = await fetch("/api/meta/send", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ canal, pageId, recipientId, texto }),
                  });
                  const d = await r.json().catch(() => ({ ok: false }));
                  if (!d.ok) {
                    console.error("Meta send fallo:", d.error);
                    throw new Error(d.error ?? "Fallo el envio");
                  }
                  dispatch({
                    type: "SEND_MESSAGE",
                    conversationId: activa.id,
                    texto,
                    staffId: yo,
                    waId: d.id,
                  });
                  return;
                }
                dispatch({ type: "SEND_MESSAGE", conversationId: activa.id, texto, staffId: yo });
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
                        staffId: yo,
                        waId: d.id,
                      });
                      setAiRefresh((n) => n + 1);
                    }
                  : undefined
              }
              onReact={async (messageId, emoji) => {
                const meta = partesMeta(activa.id);
                if (meta) {
                  await accionMeta({ ...meta, accion: "reaccionar", mid: messageId, emoji });
                  return;
                }
                // WhatsApp.
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
              // Por la página, Meta solo acepta el corazón; por la cuenta de
              // Instagram, cualquier emoji.
              emojis={activa.id.startsWith("metac-facebook-") ? ["❤️"] : undefined}
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
                      staffId: yo,
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
                dispatch({ type: "ASSIGN", conversationId: activa.id, staffId: yo });
                if (activa.canal === "whatsapp" && contactoActivo.telefono) {
                  persistirWa(contactoActivo.telefono, { asignado_a: yo });
                }
                if (activa.id.startsWith("metac-")) persistirMeta(activa.id, { asignado_a: yo });
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
                if (activa.id.startsWith("metac-")) persistirMeta(activa.id, { estado: nuevoEstado });
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
              aiRefresh={aiRefresh}
              onAsignar={(staffId) => {
                dispatch({ type: "ASSIGN", conversationId: activa.id, staffId });
                if (activa.canal === "whatsapp" && contactoActivo.telefono) {
                  persistirWa(contactoActivo.telefono, { asignado_a: staffId || null });
                }
                if (activa.id.startsWith("metac-")) persistirMeta(activa.id, { asignado_a: staffId || null });
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
              aiRefresh={aiRefresh}
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

/**
 * Canal, página y persona de una conversación real de Messenger o Instagram
 * (id metac-<canal>-<pageId>-<senderId>); null si no es una de esas.
 */
function partesMeta(id: string): { canal: "facebook" | "instagram"; pageId: string; recipientId: string } | null {
  const m = /^metac-(facebook|instagram)-(\d+)-(\d+)$/.exec(id);
  return m ? { canal: m[1] as "facebook" | "instagram", pageId: m[2], recipientId: m[3] } : null;
}

/** Reaccionar, visto o escribiendo en Messenger e Instagram. No lanza. */
async function accionMeta(cuerpo: Record<string, unknown>): Promise<void> {
  try {
    const r = await fetch("/api/meta/accion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const d = await r.json().catch(() => ({ ok: false }));
    if (!d.ok && cuerpo.accion === "reaccionar") console.error("reaccionar fallo:", d.error);
  } catch (err) {
    console.error("accion meta error:", err);
  }
}
