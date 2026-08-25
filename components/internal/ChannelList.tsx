"use client";

import { Hash, AtSign } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { staffMeta } from "@/lib/format";
import { ME } from "@/lib/data/seed";
import type { InternalChannel } from "@/lib/data/types";

export function ChannelList({
  channels,
  activoId,
  onSelect,
  yo,
  sinLeer,
  pie,
}: {
  channels: InternalChannel[];
  activoId: string | null;
  onSelect: (id: string) => void;
  /** Mi ficha del equipo: en un chat directo, el otro es el que no soy yo. */
  yo?: string;
  /** Mensajes sin leer por canal. De acá sale el punto. */
  sinLeer?: Record<string, number>;
  pie?: React.ReactNode;
}) {
  const canales = channels.filter((c) => c.tipo === "canal");
  const dms = channels.filter((c) => c.tipo === "dm");

  return (
    <div className="flex w-full shrink-0 flex-col overflow-y-auto border-r border-line bg-card lg:w-64">
      <Group titulo="Canales">
        {canales.map((c) => {
          const activo = c.id === activoId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition",
                activo ? "bg-brand text-white" : "text-[var(--text-2)] hover:bg-surface",
              )}
            >
              <Hash size={16} className={activo ? "opacity-90" : "opacity-50"} />
              <span className="min-w-0 flex-1 truncate text-left">{c.nombre}</span>
              <Punto n={sinLeer?.[c.id] ?? 0} activo={activo} />
            </button>
          );
        })}
      </Group>

      <Group titulo="Mensajes directos">
        {dms.map((c) => {
          const activo = c.id === activoId;
          const otro = c.miembros.find((m) => m !== (yo ?? ME)) ?? c.miembros[0];
          const meta = staffMeta(otro);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition",
                activo ? "bg-brand text-white" : "text-[var(--text-2)] hover:bg-surface",
              )}
            >
              <Avatar iniciales={meta.iniciales} size={24} color={meta.color} />
              <span className="min-w-0 flex-1 truncate text-left">{c.nombre}</span>
              <Punto n={sinLeer?.[c.id] ?? 0} activo={activo} />
            </button>
          );
        })}
      </Group>

      {pie}
    </div>
  );
}

/**
 * El punto de mensajes sin leer.
 *
 * Se muestra el número y no solo el punto: saber que hay algo sin leer sirve,
 * pero saber que hay ocho cambia si lo abrís ahora o después.
 */
function Punto({ n, activo }: { n: number; activo: boolean }) {
  if (n <= 0) return null;
  return (
    <span
      className={cn(
        "flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full px-1 text-[10.5px] font-bold",
        activo ? "bg-white/25 text-white" : "bg-[#dc2626] text-white",
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

function Group({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-3">
      <p className="mb-1.5 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
        <AtSign size={11} className="opacity-0" />
        {titulo}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
