import { Eye, Heart, MessageCircle, Radar, Share2, TrendingUp, Users } from "lucide-react";
import { RedBadge } from "@/components/ui/RedBadge";
import { cn } from "@/lib/cn";
import { compacto } from "@/lib/format";
import { metricasDeCuenta, ordenarCuentas } from "@/lib/social";
import type { SocialStats as SocialStatsT } from "@/lib/data/types";

const ICONO: Record<string, typeof Users> = {
  alcance: Radar,
  vistas: Eye,
  interacciones: Heart,
  meGusta: Heart,
  comentarios: MessageCircle,
  compartidos: Share2,
};

export function SocialStats({ stats, live = false }: { stats: SocialStatsT[]; live?: boolean }) {
  const cuentas = ordenarCuentas(stats);
  return (
    <div className="shrink-0 border-b border-line bg-surface px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-bold text-[var(--text)]">
          Estadísticas de cuentas
          {live && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-[#2f9e2f] ring-1 ring-[#00c040]/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00c040]" />
              EN VIVO
            </span>
          )}
        </h2>
        <span className="text-[11px] font-medium text-[var(--text-3)]">Últimos 30 días</span>
      </div>
      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          cuentas.length > 2 ? "lg:grid-cols-2 2xl:grid-cols-3" : "lg:grid-cols-2",
        )}
      >
        {cuentas.map((s) => {
          const metricas = metricasDeCuenta(s);
          return (
            <article key={s.red} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <RedBadge red={s.red} showLabel />
                  <span className="truncate text-[12px] text-[var(--text-3)]">{s.handle}</span>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold text-[#2f9e2f]">
                  <TrendingUp size={12} />
                  {s.crecimientoPct}%
                </span>
              </div>

              <div className="mb-3 flex flex-wrap items-end gap-x-2">
                <p className="text-[28px] font-extrabold leading-none tracking-tight text-[var(--text)]">
                  {compacto(s.seguidores)}
                </p>
                <p className="mb-0.5 text-[12px] font-medium text-[var(--text-3)]">
                  seguidores · +{compacto(s.nuevosSeguidores)} este mes
                </p>
              </div>

              <div
                className={cn("grid gap-2", metricas.length > 3 ? "grid-cols-4" : "grid-cols-3")}
              >
                {metricas.map((m) => (
                  <Mini
                    key={m.clave}
                    Icon={ICONO[m.clave] ?? Eye}
                    label={m.label}
                    valor={compacto(m.valor)}
                    // En TikTok la vista es la métrica que decide, no una más.
                    destacada={s.red === "tiktok" && m.clave === "vistas"}
                  />
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Mini({
  Icon,
  label,
  valor,
  destacada = false,
}: {
  Icon: typeof Users;
  label: string;
  valor: string;
  destacada?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl px-2.5 py-2",
        destacada ? "bg-brand/10 ring-1 ring-brand/25" : "bg-surface",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide",
          destacada ? "text-brand" : "text-[var(--text-3)]",
        )}
      >
        <Icon size={11} />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={cn(
          "mt-0.5 text-[15px] font-bold",
          destacada ? "text-brand" : "text-[var(--text)]",
        )}
      >
        {valor}
      </p>
    </div>
  );
}
