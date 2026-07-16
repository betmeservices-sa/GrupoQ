import { TrendingUp, Users, Eye, Radar, Heart } from "lucide-react";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { compacto } from "@/lib/format";
import type { SocialStats as SocialStatsT } from "@/lib/data/types";

export function SocialStats({ stats, live = false }: { stats: SocialStatsT[]; live?: boolean }) {
  return (
    <div className="shrink-0 border-b border-line bg-surface px-5 py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[13px] font-bold text-[#0f1b2d]">
          Estadísticas de cuentas
          {live && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-bold text-[#2f9e2f] ring-1 ring-[#00c040]/30">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#00c040]" />
              EN VIVO
            </span>
          )}
        </h2>
        <span className="text-[11px] font-medium text-[#94a3b4]">
          Meta Graph API · últimos 30 días
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {stats.map((s) => (
          <article key={s.red} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ChannelBadge channel={s.red} showLabel />
                <span className="text-[12px] text-[#94a3b4]">{s.handle}</span>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold text-[#2f9e2f]">
                <TrendingUp size={12} />
                {s.crecimientoPct}%
              </span>
            </div>

            <div className="mb-3 flex items-end gap-2">
              <p className="text-[28px] font-extrabold leading-none tracking-tight text-[#0f1b2d]">
                {compacto(s.seguidores)}
              </p>
              <p className="mb-0.5 text-[12px] font-medium text-[#94a3b4]">
                seguidores · +{s.nuevosSeguidores} este mes
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Mini Icon={Radar} label="Alcance" valor={compacto(s.alcance30d)} />
              <Mini Icon={Eye} label="Vistas" valor={compacto(s.vistas30d)} />
              <Mini Icon={Heart} label="Interacciones" valor={compacto(s.interacciones30d)} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function Mini({
  Icon,
  label,
  valor,
}: {
  Icon: typeof Users;
  label: string;
  valor: string;
}) {
  return (
    <div className="rounded-xl bg-surface px-2.5 py-2">
      <p className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-[#94a3b4]">
        <Icon size={11} />
        {label}
      </p>
      <p className="mt-0.5 text-[15px] font-bold text-[#0f1b2d]">{valor}</p>
    </div>
  );
}
