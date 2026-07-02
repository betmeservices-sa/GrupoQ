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
}: {
  channels: InternalChannel[];
  activoId: string | null;
  onSelect: (id: string) => void;
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
                activo ? "bg-brand text-white" : "text-[#5b6b80] hover:bg-surface",
              )}
            >
              <Hash size={16} className={activo ? "opacity-90" : "opacity-50"} />
              {c.nombre}
            </button>
          );
        })}
      </Group>

      <Group titulo="Mensajes directos">
        {dms.map((c) => {
          const activo = c.id === activoId;
          const otro = c.miembros.find((m) => m !== ME) ?? c.miembros[0];
          const meta = staffMeta(otro);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium transition",
                activo ? "bg-brand text-white" : "text-[#5b6b80] hover:bg-surface",
              )}
            >
              <Avatar iniciales={meta.iniciales} size={24} color={meta.color} />
              <span className="truncate">{c.nombre}</span>
            </button>
          );
        })}
      </Group>
    </div>
  );
}

function Group({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="px-2.5 py-3">
      <p className="mb-1.5 flex items-center gap-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b4]">
        <AtSign size={11} className="opacity-0" />
        {titulo}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
