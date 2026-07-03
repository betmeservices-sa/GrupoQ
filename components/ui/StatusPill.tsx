import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import type { ConversationStatus } from "@/lib/data/types";

// "Nuevo" usa el color de acento del tenant (rojo en Grupo Q, azul en el
// hospital) vía CSS vars. Los demás estados son neutros (ámbar/verde) e iguales
// para todos.
const MAP: Record<
  ConversationStatus,
  { label: string; className: string; style?: CSSProperties }
> = {
  nuevo: {
    label: "Nuevo",
    className: "ring-1",
    style: {
      backgroundColor: "var(--brand-accent-soft)",
      color: "var(--brand-accent)",
    },
  },
  en_progreso: {
    label: "En progreso",
    className: "bg-amber-50 text-amber-700 ring-1 ring-amber-300/50",
  },
  resuelto: {
    label: "Resuelto",
    className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-300/50",
  },
};

export function StatusPill({
  estado,
  className,
}: {
  estado: ConversationStatus;
  className?: string;
}) {
  const { label, className: tone, style } = MAP[estado];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tone,
        className,
      )}
      style={style}
    >
      {label}
    </span>
  );
}
