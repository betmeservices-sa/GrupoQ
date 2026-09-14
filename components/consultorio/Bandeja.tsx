"use client";

// La bandeja de la clínica, de muestra.
//
// Es de SOLO LECTURA y lo dice en pantalla: no hay WhatsApp conectado, las
// conversaciones son de demostración y no se puede responder desde acá. Se
// enseña para que se vea cómo llega lo que la gente escribe y cómo contesta el
// agente, no para trabajarla.
//
// Por eso tampoco hay plantillas, ni ventana de 24 horas, ni asignación: todo
// eso existe cuando el canal es real, y ponerlo acá sería prometer una cosa que
// este demo no hace.

import { useState } from "react";
import { Facebook, Instagram, Lock, MessageCircle } from "lucide-react";

export interface MensajeDemo {
  id: string;
  autor: "cliente" | "staff";
  quien: string;
  texto: string;
  ts: string;
}

export interface ChatDemo {
  id: string;
  nombre: string;
  canal: "whatsapp" | "facebook" | "instagram";
  departamento: string;
  estado: string;
  noLeidos: number;
  ultimo: string;
  mensajes: MensajeDemo[];
}

const ICONO = {
  whatsapp: MessageCircle,
  facebook: Facebook,
  instagram: Instagram,
} as const;

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

const dia = (iso: string) =>
  new Date(iso).toLocaleDateString("es-SV", { day: "numeric", month: "short" });

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-SV", { hour: "numeric", minute: "2-digit" });

export function Bandeja({ chats }: { chats: ChatDemo[] }) {
  const [abierto, setAbierto] = useState<string>(chats[0]?.id ?? "");
  const chat = chats.find((c) => c.id === abierto) ?? chats[0];

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="min-h-0 overflow-y-auto border-r border-[var(--linea)] bg-[var(--panel)]">
        {chats.map((c) => {
          const Icono = ICONO[c.canal];
          const on = c.id === chat?.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setAbierto(c.id)}
              className={`flex w-full items-start gap-3 border-b border-[var(--linea)] px-4 py-3 text-left transition ${
                on ? "bg-[var(--verde-claro)]" : "hover:bg-[var(--panel-2)]"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--panel-2)] font-serif text-[14px] text-[var(--texto)]">
                {iniciales(c.nombre)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-serif text-[15px] text-[var(--texto)]">
                    {c.nombre}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-[var(--texto-3)]">
                    {dia(c.ultimo)}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[13px] text-[var(--texto-2)]">
                  {c.mensajes.at(-1)?.texto ?? ""}
                </span>
                <span className="mt-1.5 flex items-center gap-2">
                  <Icono size={13} className="shrink-0 text-[var(--texto-3)]" />
                  <span className="chip chip-gris">{c.departamento}</span>
                  {c.noLeidos > 0 && <span className="chip chip-verde">{c.noLeidos}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </aside>

      {chat && (
        <section className="flex min-h-0 flex-col">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--linea)] bg-[var(--panel)] px-6 py-4">
            <span className="font-serif text-[18px] text-[var(--texto)]">{chat.nombre}</span>
            <span className="chip chip-gris">{chat.departamento}</span>
            <span className="text-[12.5px] text-[var(--texto-3)]">
              {chat.canal === "whatsapp"
                ? "WhatsApp"
                : chat.canal === "facebook"
                  ? "Messenger"
                  : "Instagram"}
            </span>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
            {chat.mensajes.map((m) => {
              const mio = m.autor === "staff";
              return (
                <div key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[min(560px,85%)] rounded-[var(--r)] px-4 py-2.5 ${
                      mio
                        ? "bg-[var(--verde-claro)] text-[var(--texto)]"
                        : "border border-[var(--linea)] bg-[var(--panel)] text-[var(--texto)]"
                    }`}
                  >
                    <p className="text-[11.5px] font-semibold text-[var(--texto-3)]">{m.quien}</p>
                    <p className="mt-0.5 text-[14.5px] leading-relaxed">{m.texto}</p>
                    <p className="mt-1 text-right text-[11px] text-[var(--texto-3)]">{hora(m.ts)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <footer className="flex items-center gap-2 border-t border-[var(--linea)] bg-[var(--panel-2)] px-6 py-3 text-[13px] text-[var(--texto-2)]">
            <Lock size={14} className="shrink-0 text-[var(--texto-3)]" />
            Conversaciones de demostración. No hay WhatsApp conectado todavía, así que desde acá no
            se responde.
          </footer>
        </section>
      )}
    </div>
  );
}
