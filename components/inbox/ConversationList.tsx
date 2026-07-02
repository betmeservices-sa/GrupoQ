import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConversationListItem } from "./ConversationListItem";
import type { Contact, Conversation, Message } from "@/lib/data/types";

export interface ListaItem {
  conversation: Conversation;
  contact: Contact;
  ultimo?: Message;
}

export function ConversationList({
  items,
  activaId,
  onSelect,
}: {
  items: ListaItem[];
  activaId: string | null;
  onSelect: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        Icon={Inbox}
        titulo="Sin conversaciones"
        descripcion="No hay conversaciones que coincidan con los filtros."
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {items.map((it) => (
        <ConversationListItem
          key={it.conversation.id}
          conversation={it.conversation}
          contact={it.contact}
          ultimo={it.ultimo}
          activa={it.conversation.id === activaId}
          onClick={() => onSelect(it.conversation.id)}
        />
      ))}
    </div>
  );
}
