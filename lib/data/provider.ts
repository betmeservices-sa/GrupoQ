// Costura FAKE/REAL: toda la UI consume esta interfaz.
// Hoy la implementa FakeCommsProvider (datos en memoria desde el seed).
// Mañana, un RealCommsProvider implementaría lo mismo contra la API de
// WhatsApp Business (Meta Cloud), Instagram y Facebook, sin tocar la UI.

import {
  contacts as seedContacts,
  conversations as seedConversations,
  internalChannels as seedInternalChannels,
  internalMessages as seedInternalMessages,
  messages as seedMessages,
  metrics as seedMetrics,
  socialPosts as seedSocialPosts,
  socialStats as seedSocialStats,
} from "./seed";
import type {
  Contact,
  Conversation,
  InternalChannel,
  InternalMessage,
  Message,
  Metric,
  SocialPost,
  SocialStats,
} from "./types";

export interface CommsProvider {
  listConversations(): Conversation[];
  getMessages(conversationId: string): Message[];
  getContact(id: string): Contact | undefined;
  listContacts(): Contact[];
  listInternalChannels(): InternalChannel[];
  getInternalMessages(channelId: string): InternalMessage[];
  listSocialPosts(): SocialPost[];
  getSocialStats(): SocialStats[];
  getMetrics(): Metric[];
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class FakeCommsProvider implements CommsProvider {
  private conversations: Conversation[];
  private messages: Message[];
  private contacts: Contact[];
  private internalChannels: InternalChannel[];
  private internalMessages: InternalMessage[];
  private socialPosts: SocialPost[];
  private socialStats: SocialStats[];
  private metrics: Metric[];

  constructor() {
    // Clonamos el seed para que el store sea dueño de un estado mutable propio
    // y nunca contamine los datos originales.
    this.conversations = clone(seedConversations);
    this.messages = clone(seedMessages);
    this.contacts = clone(seedContacts);
    this.internalChannels = clone(seedInternalChannels);
    this.internalMessages = clone(seedInternalMessages);
    this.socialPosts = clone(seedSocialPosts);
    this.socialStats = clone(seedSocialStats);
    this.metrics = clone(seedMetrics);
  }

  listConversations(): Conversation[] {
    return clone(this.conversations);
  }

  getMessages(conversationId: string): Message[] {
    return clone(
      this.messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.ts.localeCompare(b.ts)),
    );
  }

  getContact(id: string): Contact | undefined {
    const found = this.contacts.find((c) => c.id === id);
    return found ? clone(found) : undefined;
  }

  listContacts(): Contact[] {
    return clone(this.contacts);
  }

  listInternalChannels(): InternalChannel[] {
    return clone(this.internalChannels);
  }

  getInternalMessages(channelId: string): InternalMessage[] {
    return clone(
      this.internalMessages
        .filter((m) => m.channelId === channelId)
        .sort((a, b) => a.ts.localeCompare(b.ts)),
    );
  }

  listSocialPosts(): SocialPost[] {
    return clone(this.socialPosts);
  }

  getSocialStats(): SocialStats[] {
    return clone(this.socialStats);
  }

  getMetrics(): Metric[] {
    return clone(this.metrics);
  }
}

export const fakeProvider = new FakeCommsProvider();
