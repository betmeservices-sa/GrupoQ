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
  Contact,
  Conversation,
  ConversationStatus,
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
  tsSeq: number;
  idSeq: number;
}

export type StoreAction =
  | { type: "SEND_MESSAGE"; conversationId: string; texto: string; staffId: string; waId?: string }
  | { type: "ASSIGN"; conversationId: string; staffId: string }
  | { type: "SET_STATUS"; conversationId: string; estado: ConversationStatus }
  | { type: "SET_DEPARTMENT"; conversationId: string; departamento: Conversation["departamento"] }
  | { type: "MARK_READ"; conversationId: string }
  | { type: "NUEVA_CONVERSACION_WA"; telefono: string; nombre?: string }
  | { type: "ELIMINAR_CONVERSACION"; conversationId: string }
  | { type: "INCOMING"; conversationId: string; texto: string }
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
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.conversationId
            ? {
                ...c,
                asignadoA: action.staffId,
                // Asignarse = atender: deja de ser "nuevo".
                estado: c.estado === "nuevo" ? "en_progreso" : c.estado,
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
      const ts = tsFromSeq(state.tsSeq);
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
