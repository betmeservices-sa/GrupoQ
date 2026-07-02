import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function MetricCard({
  label,
  valor,
  delta,
  Icon,
}: {
  label: string;
  valor: string | number;
  delta?: number;
  Icon: LucideIcon;
}) {
  const subiendo = (delta ?? 0) >= 0;
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon size={18} />
        </span>
        {delta !== undefined && delta !== 0 && (
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-bold",
              subiendo ? "bg-emerald-50 text-[#2f9e2f]" : "bg-rose-50 text-rose-600",
            )}
          >
            {subiendo ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-[26px] font-extrabold leading-none tracking-tight text-[#0f1b2d]">
        {valor}
      </p>
      <p className="mt-1.5 text-[12.5px] font-medium text-[#94a3b4]">{label}</p>
    </div>
  );
}
