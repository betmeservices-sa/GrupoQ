"use client";

import { useEffect, useRef, useState } from "react";
import { Inbox, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConversationListItem } from "./ConversationListItem";
import type { Contact, Conversation, Message } from "@/lib/data/types";

export interface ListaItem {
  conversation: Conversation;
  contact: Contact;
  ultimo?: Message;
  escribiendo?: boolean;
}

// Cuántas se pintan de entrada, y de a cuántas crece al bajar.
//
// Existe porque la importación dejó más de mil setecientas conversaciones, y
// pintarlas todas de golpe traba el navegador al abrir la bandeja. Nadie baja
// mil setecientas filas: se lee lo de arriba y se busca el resto.
const PRIMERAS = 20;
const DE_A = 20;

export function ConversationList({
  items,
  activaId,
  onSelect,
  cargandoHistorial = false,
}: {
  items: ListaItem[];
  activaId: string | null;
  onSelect: (id: string) => void;
  /** Todavía falta historial por bajar: la lista está incompleta y se dice. */
  cargandoHistorial?: boolean;
}) {
  const [visibles, setVisibles] = useState(PRIMERAS);
  const marcaRef = useRef<HTMLDivElement>(null);

  // Al cambiar de filtro se vuelve arriba: si no, un filtro que deja tres
  // conversaciones heredaría el "ya mostré cuatrocientas" del anterior.
  useEffect(() => {
    setVisibles(PRIMERAS);
  }, [items.length]);

  // Crece sola al llegar al final, sin botón de por medio.
  useEffect(() => {
    const marca = marcaRef.current;
    if (!marca) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) setVisibles((v) => v + DE_A);
      },
      { rootMargin: "300px" },
    );
    obs.observe(marca);
    return () => obs.disconnect();
  }, [items.length]);

  if (items.length === 0) {
    if (cargandoHistorial) {
      return (
        <div className="flex flex-1 items-center justify-center gap-2 p-6 text-[13px] text-[var(--text-3)]">
          <Loader2 size={15} className="animate-spin" />
          Trayendo las conversaciones
        </div>
      );
    }
    return (
      <EmptyState
        Icon={Inbox}
        titulo="Sin conversaciones"
        descripcion="No hay conversaciones que coincidan con los filtros."
      />
    );
  }

  const mostradas = items.slice(0, visibles);
  const faltan = items.length - mostradas.length;

  return (
    <div className="flex-1 overflow-y-auto">
      {mostradas.map((it) => (
        <ConversationListItem
          key={it.conversation.id}
          conversation={it.conversation}
          contact={it.contact}
          ultimo={it.ultimo}
          escribiendo={it.escribiendo}
          activa={it.conversation.id === activaId}
          onClick={() => onSelect(it.conversation.id)}
        />
      ))}

      {/* La marca que dispara el siguiente tramo al acercarse. */}
      <div ref={marcaRef} />

      {faltan > 0 && (
        <div className="px-4 py-3 text-center text-[12px] text-[var(--text-3)]">
          {faltan} conversaciones más
        </div>
      )}
      {cargandoHistorial && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 text-[12px] text-[var(--text-3)]">
          <Loader2 size={13} className="animate-spin" />
          Todavía trayendo historial
        </div>
      )}
    </div>
  );
}
