import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

export function EmptyState({
  titulo,
  descripcion,
  Icon = Inbox,
}: {
  titulo: string;
  descripcion?: string;
  Icon?: LucideIcon;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Icon size={26} strokeWidth={1.8} />
      </span>
      <p className="text-sm font-semibold text-slate-700">{titulo}</p>
      {descripcion && <p className="max-w-xs text-xs text-slate-400">{descripcion}</p>}
    </div>
  );
}
