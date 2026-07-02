import { departments } from "@/lib/data/seed";
import type { Conversation } from "@/lib/data/types";

export function DeptBreakdown({ conversations }: { conversations: Conversation[] }) {
  const filas = departments
    .map((d) => ({
      ...d,
      total: conversations.filter((c) => c.departamento === d.id).length,
    }))
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total);

  const max = Math.max(1, ...filas.map((f) => f.total));

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold text-[#0f1b2d]">Conversaciones por departamento</h2>
      <div className="space-y-3">
        {filas.map((f) => (
          <div key={f.id} className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-[12.5px] font-medium text-[#5b6b80]">
              {f.nombre}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(f.total / max) * 100}%`, backgroundColor: f.color }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-[12.5px] font-bold text-[#0f1b2d]">
              {f.total}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
