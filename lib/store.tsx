"use client";

import {
  createContext,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import { fakeProvider } from "./data/provider";
import { telefonoBonito } from "./phone";
import { activeTenant } from "./tenants/active";
import type {
  Channel,
  Contact,
  Conversation,
  ConversationStatus,
  DepartmentId,
  InternalChannel,
  InternalMessage,
  Message,
  Metric,
  SocialPost,
  SocialStats,
} from "./data/types";

export interface StoreState {
  conversations: Conversation[];
  messages: Message[];
  contacts: Contact[];
  internalChannels: InternalChannel[];
  internalMessages: InternalMessage[];
  socialPosts: SocialPost[];
  socialStats: SocialStats[];
  metrics: Metric[];
  // Conversaciones donde el agente está redactando (indicador de escribiendo).
  escribiendo: string[];
  tsSeq: number;
  idSeq: number;
}

export type StoreAction =
  | { type: "SEND_MESSAGE"; conversationId: string; texto: string; staffId: string; waId?: string }
  | { type: "ASSIGN"; conversationId: string; staffId: string | null }
  | { type: "SET_STATUS"; conversationId: string; estado: ConversationStatus }
  | { type: "SET_DEPARTMENT"; conversationId: string; departamento: Conversation["departamento"] }
  | { type: "MARK_READ"; conversationId: string }
  | { type: "NUEVA_CONVERSACION_WA"; telefono: string; nombre?: string }
  | { type: "ELIMINAR_CONVERSACION"; conversationId: string }
  | {
      type: "INCOMING";
      conversationId: string;
      texto: string;
      // Si la conversación no existe todavía, se crea con estos datos (así la
      // simulación puede estrenar un contacto que nadie tenía en la bandeja).
      nueva?: {
        canal: Exclude<Channel, "internal">;
        nombre: string;
        telefono?: string;
        handle?: string;
        departamento?: DepartmentId;
      };
    }
  // Respuesta automática del agente de IA (staff sin persona detrás).
  | { type: "RESPUESTA_IA"; conversationId: string; texto: string }
  | { type: "ESCRIBIENDO"; conversationId: string; activo: boolean }
  | { type: "SEND_INTERNAL"; channelId: string; texto: string; staffId: string }
  | { type: "ADD_SOCIAL_POST"; red: SocialPost["red"]; texto: string; fecha: string }
  | {
      type: "WHATSAPP_INCOMING";
      waId: string;
      from: string;
      nombre?: string;
      texto: string;
      ts: string;
      direccion?: "in" | "out";
      media?: Message["media"];
    }
  | {
      // Mensaje real de Messenger o Instagram (sondea /api/meta/inbox).
      type: "META_INCOMING";
      mid: string;
      canal: "facebook" | "instagram";
      pageId: string;
      /** Nombre de la pagina por la que entro (Yali tiene dos). */
      paginaNombre?: string;
      senderId: string;
      senderName?: string;
      texto: string;
      ts: string;
      direction?: "in" | "out";
    }
  | {
      // Rehidrata asignado/estado/departamento de la BD al montar.
      type: "HIDRATAR_CONVERSACION";
      wa_from: string;
      asignado_a: string | null;
      estado: string | null;
      departamento: string | null;
    };

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Timestamp determinista por contador, siempre posterior al seed (que termina
// 10:31). Evita Date.now para que los tests sean estables.
export function tsFromSeq(seq: number): string {
  const hour = 11 + Math.floor(seq / 60);
  const min = seq % 60;
  return `2026-06-23T${pad(hour)}:${pad(min)}:00`;
}

export function createInitialState(): StoreState {
  return {
    // Demo: la bandeja arranca con el seed (sin credenciales no hay WhatsApp
    // real). Las conversaciones reales se agregan encima vía WHATSAPP_INCOMING.
    conversations: fakeProvider.listConversations(),
    messages: fakeProvider
      .listConversations()
      .flatMap((c) => fakeProvider.getMessages(c.id)),
    contacts: fakeProvider.listContacts(),
    internalChannels: fakeProvider.listInternalChannels(),
    internalMessages: fakeProvider
      .listInternalChannels()
      .flatMap((c) => fakeProvider.getInternalMessages(c.id)),
    socialPosts: fakeProvider.listSocialPosts(),
    socialStats: fakeProvider.getSocialStats(),
    metrics: fakeProvider.getMetrics(),
    escribiendo: [],
    tsSeq: 1,
    idSeq: 1,
  };
}

export function storeReducer(state: StoreState, action: StoreAction): StoreState {
  switch (action.type) {
    case "SEND_MESSAGE": {
      // Hora real para que la respuesta del staff ordene después del mensaje
      // real del cliente (que viene con timestamp real de WhatsApp).
      const ts = new Date().toISOString();
      const msg: Message = {
        id: action.waId ?? `nm${state.idSeq}`,
        conversationId: action.conversationId,
        autor: "staff",
        staffId: action.staffId,
        texto: action.texto,
        ts,
      };
      return {
        ...state,
        messages: [...state.messages, msg],
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId
            ? {
                ...c,
                ultimoMensajeTs: ts,
                estado: c.estado === "nuevo" ? "en_progreso" : c.estado,
              }
            : c,
        ),
        tsSeq: state.tsSeq + 1,
        idSeq: state.idSeq + 1,
      };
    }
    case "ASSIGN":
      // staffId null = el chat vuelve a no tener dueño, o sea vuelve a manos del
      // agente de IA. Es lo que hace el botón "Devolver a Sofía" en Mis chats.
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId
            ? {
                ...c,
                asignadoA: action.staffId ?? undefined,
                // Asignarse = atender: deja de ser "nuevo".
                estado: action.staffId && c.estado === "nuevo" ? "en_progreso" : c.estado,
              }
            : c,
        ),
      };
    case "SET_STATUS":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, estado: action.estado } : c,
        ),
      };
    case "SET_DEPARTMENT":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, departamento: action.departamento } : c,
        ),
      };
    case "MARK_READ":
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, noLeidos: 0 } : c,
        ),
      };
    case "INCOMING": {
      // Hora real: así el mensaje sube al tope de la bandeja y se lee "recién
      // llegado", sin importar de qué fecha sean los datos semilla del tenant.
      const ts = new Date().toISOString();
      const existe = state.conversations.some((c) => c.id === action.conversationId);

      // Conversación estrenada: primero su contacto, luego el hilo arriba de todo.
      if (!existe && action.nueva) {
        const contactId = `sc-${action.conversationId}`;
        const contacto: Contact = {
          id: contactId,
          nombre: action.nueva.nombre,
          telefono: action.nueva.telefono,
          handle: action.nueva.handle,
          canal: action.nueva.canal,
        };
        const conversacion: Conversation = {
          id: action.conversationId,
          canal: action.nueva.canal,
          contactId,
          departamento: action.nueva.departamento ?? activeTenant().defaultDepartment,
          estado: "nuevo",
          noLeidos: 1,
          ultimoMensajeTs: ts,
        };
        return {
          ...state,
          contacts: [contacto, ...state.contacts],
          conversations: [conversacion, ...state.conversations],
          messages: [
            ...state.messages,
            {
              id: `nm${state.idSeq}`,
              conversationId: action.conversationId,
              autor: "cliente",
              texto: action.texto,
              ts,
            },
          ],
          tsSeq: state.tsSeq + 1,
          idSeq: state.idSeq + 1,
        };
      }

      if (!existe) return state;

      const msg: Message = {
        id: `nm${state.idSeq}`,
        conversationId: action.conversationId,
        autor: "cliente",
        texto: action.texto,
        ts,
      };
      return {
        ...state,
        messages: [...state.messages, msg],
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId
            ? {
                ...c,
                ultimoMensajeTs: ts,
                noLeidos: c.noLeidos + 1,
                estado: c.estado === "resuelto" ? "en_progreso" : c.estado,
              }
            : c,
        ),
        tsSeq: state.tsSeq + 1,
        idSeq: state.idSeq + 1,
      };
    }
    case "RESPUESTA_IA": {
      if (!state.conversations.some((c) => c.id === action.conversationId)) return state;
      const ts = new Date().toISOString();
      // Sin staffId: la burbuja lo muestra como "Asistente IA".
      const msg: Message = {
        id: `nia${state.idSeq}`,
        conversationId: action.conversationId,
        autor: "staff",
        texto: action.texto,
        ts,
      };
      return {
        ...state,
        messages: [...state.messages, msg],
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId
            ? { ...c, ultimoMensajeTs: ts, estado: c.estado === "nuevo" ? "en_progreso" : c.estado }
            : c,
        ),
        escribiendo: state.escribiendo.filter((id) => id !== action.conversationId),
        idSeq: state.idSeq + 1,
      };
    }
    case "ESCRIBIENDO": {
      const dentro = state.escribiendo.includes(action.conversationId);
      if (action.activo === dentro) return state;
      return {
        ...state,
        escribiendo: action.activo
          ? [...state.escribiendo, action.conversationId]
          : state.escribiendo.filter((id) => id !== action.conversationId),
      };
    }
    case "SEND_INTERNAL": {
      const ts = tsFromSeq(state.tsSeq);
      const msg: InternalMessage = {
        id: `nim${state.idSeq}`,
        channelId: action.channelId,
        staffId: action.staffId,
        texto: action.texto,
        ts,
      };
      return {
        ...state,
        internalMessages: [...state.internalMessages, msg],
        tsSeq: state.tsSeq + 1,
        idSeq: state.idSeq + 1,
      };
    }
    case "ADD_SOCIAL_POST": {
      const post: SocialPost = {
        id: `nsp${state.idSeq}`,
        red: action.red,
        estado: "programado",
        texto: action.texto,
        fecha: action.fecha,
      };
      return {
        ...state,
        socialPosts: [post, ...state.socialPosts],
        idSeq: state.idSeq + 1,
      };
    }
    case "WHATSAPP_INCOMING": {
      // Dedup: si ya procesamos este id de WhatsApp, no hacemos nada.
      if (state.messages.some((m) => m.id === action.waId)) return state;

      const esEntrante = action.direccion !== "out"; // out = lo envió la empresa
      // Departamento de arranque de una conversación nueva, según el tenant.
      const deptDefault = activeTenant().defaultDepartment;

      const existente = state.contacts.find(
        (c) => c.canal === "whatsapp" && c.telefono === action.from,
      );

      let contacts = state.contacts;
      let conversations = state.conversations;
      let conversationId: string;

      if (existente) {
        const conv = state.conversations.find(
          (c) => c.canal === "whatsapp" && c.contactId === existente.id,
        );
        if (conv) {
          conversationId = conv.id;
          conversations = state.conversations.map((c) =>
            c.id === conv.id
              ? {
                  ...c,
                  ultimoMensajeTs: action.ts,
                  noLeidos: esEntrante ? c.noLeidos + 1 : c.noLeidos,
                  estado: c.estado === "resuelto" ? "en_progreso" : c.estado,
                }
              : c,
          );
        } else {
          conversationId = `wac-${action.from}`;
          conversations = [
            {
              id: conversationId,
              canal: "whatsapp",
              contactId: existente.id,
              departamento: deptDefault,
              estado: "nuevo",
              noLeidos: esEntrante ? 1 : 0,
              ultimoMensajeTs: action.ts,
            },
            ...state.conversations,
          ];
        }
      } else {
        const contactId = `wa-${action.from}`;
        const nuevoContacto: Contact = {
          id: contactId,
          // Muestra "7629-4980" en vez de "+50376294980" cuando no hay nombre.
          nombre: action.nombre || telefonoBonito(action.from),
          telefono: action.from,
          canal: "whatsapp",
        };
        contacts = [nuevoContacto, ...state.contacts];
        conversationId = `wac-${action.from}`;
        conversations = [
          {
            id: conversationId,
            canal: "whatsapp",
            contactId,
            departamento: deptDefault,
            estado: "nuevo",
            noLeidos: esEntrante ? 1 : 0,
            ultimoMensajeTs: action.ts,
          },
          ...state.conversations,
        ];
      }

      const msg: Message = {
        id: action.waId,
        conversationId,
        autor: esEntrante ? "cliente" : "staff",
        texto: action.texto,
        ts: action.ts,
        media: action.media,
      };

      return { ...state, contacts, conversations, messages: [...state.messages, msg] };
    }
    case "META_INCOMING": {
      // Mensaje real de Messenger/Instagram. Mismo esquema que WHATSAPP_INCOMING
      // con ids deterministas: la conversación lleva canal, página y remitente
      // (metac-<canal>-<pageId>-<senderId>) para que responder sepa a dónde va.
      if (state.messages.some((m) => m.id === action.mid)) return state;

      const esEntrante = action.direction !== "out";
      const deptDefault = activeTenant().defaultDepartment;
      const conversationId = `metac-${action.canal}-${action.pageId}-${action.senderId}`;
      const contactId = `meta-${action.canal}-${action.senderId}`;

      let contacts = state.contacts;
      let conversations = state.conversations;

      const conv = state.conversations.find((c) => c.id === conversationId);
      if (conv) {
        conversations = state.conversations.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                ultimoMensajeTs: action.ts,
                noLeidos: esEntrante ? c.noLeidos + 1 : c.noLeidos,
                // Contestar es atender: deja de ser "nuevo". Vale igual si la
                // respuesta salio desde el panel o desde el celular, porque
                // Meta nos avisa de las dos.
                estado:
                  !esEntrante && c.estado === "nuevo"
                    ? "en_progreso"
                    : c.estado === "resuelto"
                      ? "en_progreso"
                      : c.estado,
                paginaNombre: c.paginaNombre ?? action.paginaNombre,
              }
            : c,
        );
      } else {
        if (!state.contacts.some((c) => c.id === contactId)) {
          const nuevoContacto: Contact = {
            id: contactId,
            // Sin nombre de perfil (Meta no lo manda en el webhook): se muestra
            // el canal + el final del id, p. ej. "IG 483920".
            nombre:
              action.senderName ||
              `${action.canal === "instagram" ? "IG" : "FB"} ${action.senderId.slice(-6)}`,
            // El id de Meta NO es un arroba: es un numero interno, distinto
            // para cada pagina, que no sirve para buscar a nadie. Mostrarlo en
            // la ficha como si fuera el usuario confunde mas de lo que ayuda.
            // Para responder no hace falta: el destinatario sale del id de la
            // conversacion.
            handle: undefined,
            canal: action.canal,
          };
          contacts = [nuevoContacto, ...state.contacts];
        }
        conversations = [
          {
            id: conversationId,
            canal: action.canal,
            contactId,
            departamento: deptDefault,
            estado: "nuevo",
            noLeidos: esEntrante ? 1 : 0,
            ultimoMensajeTs: action.ts,
            paginaNombre: action.paginaNombre,
          },
          ...state.conversations,
        ];
      }

      const msg: Message = {
        id: action.mid,
        conversationId,
        autor: esEntrante ? "cliente" : "staff",
        texto: action.texto,
        ts: action.ts,
      };

      return { ...state, contacts, conversations, messages: [...state.messages, msg] };
    }
    case "NUEVA_CONVERSACION_WA": {
      // Abre (o crea) el chat de WhatsApp de un contacto desde la pestaña
      // Contactos. Id determinista `wac-<tel>`: si luego llega un mensaje real,
      // se dedup a la misma conversación.
      const tel = action.telefono;
      const conversationId = `wac-${tel}`;
      if (state.conversations.some((c) => c.id === conversationId)) return state;

      const existente = state.contacts.find(
        (c) => c.canal === "whatsapp" && c.telefono === tel,
      );
      const nuevaConv: Conversation = {
        id: conversationId,
        canal: "whatsapp",
        contactId: existente ? existente.id : `wa-${tel}`,
        departamento: activeTenant().defaultDepartment,
        estado: "nuevo",
        noLeidos: 0,
        ultimoMensajeTs: tsFromSeq(state.tsSeq),
      };
      const contacts = existente
        ? state.contacts
        : [
            {
              id: `wa-${tel}`,
              nombre: action.nombre?.trim() || telefonoBonito(tel),
              telefono: tel,
              canal: "whatsapp" as const,
            },
            ...state.contacts,
          ];
      return {
        ...state,
        contacts,
        conversations: [nuevaConv, ...state.conversations],
        tsSeq: state.tsSeq + 1,
      };
    }
    case "ELIMINAR_CONVERSACION": {
      const conv = state.conversations.find((c) => c.id === action.conversationId);
      if (!conv) return state;
      const conversations = state.conversations.filter((c) => c.id !== action.conversationId);
      const messages = state.messages.filter((m) => m.conversationId !== action.conversationId);
      // Borra el contacto solo si ninguna otra conversación lo usa.
      const enUso = conversations.some((c) => c.contactId === conv.contactId);
      const contacts = enUso
        ? state.contacts
        : state.contacts.filter((c) => c.id !== conv.contactId);
      return { ...state, conversations, messages, contacts };
    }
    case "HIDRATAR_CONVERSACION": {
      // Solo aplica si la conversación ya existe en el store (creada por WHATSAPP_INCOMING).
      const convId = `wac-${action.wa_from}`;
      const existe = state.conversations.some((c) => c.id === convId);
      if (!existe) return state;
      return {
        ...state,
        conversations: state.conversations.map((c) => {
          if (c.id !== convId) return c;
          const updates: Partial<Conversation> = {};
          // null = desasignar explicitamente; los enums solo se aplican si vienen.
          if (action.asignado_a !== undefined) updates.asignadoA = action.asignado_a ?? undefined;
          if (action.estado != null) updates.estado = action.estado as ConversationStatus;
          if (action.departamento != null) updates.departamento = action.departamento as Conversation["departamento"];
          return { ...c, ...updates };
        }),
      };
    }
    default:
      return state;
  }
}

interface StoreContextValue {
  state: StoreState;
  dispatch: Dispatch<StoreAction>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(storeReducer, undefined, createInitialState);
  return (
    <StoreContext.Provider value={{ state, dispatch }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStore debe usarse dentro de <StoreProvider>");
  }
  return ctx;
}
