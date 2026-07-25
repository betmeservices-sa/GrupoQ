"use client";

import { fmtDuracion } from "@/lib/calls-format";
import type { CallMetrics } from "@/lib/data/types";

// Vista de cliente por PLAN: sin precios, sin carrier, sin ElevenLabs, sin
// desglose de Vapi. Solo cuantas llamadas, cuanto duraron y cuantos minutos del
// plan quedan. El plan es un bucket fijo (sin nombre) de minutos incluidos.
const PLAN_MIN = 500;

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <p className="text-[12px] text-[var(--text-3)]">{label}</p>
      <p className="mt-1 text-[26px] font-extrabold tracking-tight text-[var(--text)]">{value}</p>
      {sub && <p className="mt-0.5 text-[11.5px] text-[var(--text-3)]">{sub}</p>}
    </div>
  );
}

export function PlanBucket({ metrics }: { metrics: CallMetrics }) {
  const usados = metrics.minutosTotales;
  const restantes = Math.max(0, PLAN_MIN - usados);
  const pct = Math.min(1, PLAN_MIN > 0 ? usados / PLAN_MIN : 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi
          label="Llamadas"
          value={String(metrics.total)}
          sub={`${metrics.entrantes} entrantes · ${metrics.salientes} salientes`}
        />
        <Kpi
          label="Duración total"
          value={fmtDuracion(Math.round(usados * 60))}
          sub={`promedio ${fmtDuracion(metrics.duracionPromedioSeg)} por llamada`}
        />
        <Kpi
          label="Minutos restantes"
          value={restantes.toFixed(0)}
          sub={`de ${PLAN_MIN} del plan`}
        />
      </div>

      <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
              Plan
            </p>
            <p className="mt-1 text-[15px] font-bold text-[var(--text)]">
              {usados.toFixed(1)}{" "}
              <span className="font-medium text-[var(--text-2)]">
                de {PLAN_MIN} minutos usados
              </span>
            </p>
          </div>
          <p className="text-[13px] font-semibold text-brand">
            {restantes.toFixed(0)} min restantes
          </p>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#22d3ee] via-[#8b5cf6] to-[#e879f9]"
            style={{ width: `${Math.max(2, pct * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
