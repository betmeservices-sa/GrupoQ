"use client";

import { COLOR_OUTCOME, ETIQUETA_OUTCOME, fmtPorcentaje } from "@/lib/calls-format";
import type { CallMetrics, CallOutcome } from "@/lib/data/types";

export function OutcomePanel({ metrics }: { metrics: CallMetrics }) {
  const entradas = (Object.keys(metrics.porOutcome) as CallOutcome[])
    .map((o) => ({ outcome: o, total: metrics.porOutcome[o] }))
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total);

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold text-[#0f1b2d]">Resultado de las llamadas</h2>

      <ul className="mb-5 space-y-2">
        {entradas.map(({ outcome, total }) => (
          <li key={outcome} className="flex items-center justify-between text-xs">
            <span className={`rounded-full px-2 py-1 font-medium ${COLOR_OUTCOME[outcome]}`}>
              {ETIQUETA_OUTCOME[outcome]}
            </span>
            <span className="font-semibold text-[#0f1b2d]">
              {total}{" "}
              <span className="text-[#94a3b4]">
                ({fmtPorcentaje(total / (metrics.total || 1))})
              </span>
            </span>
          </li>
        ))}
      </ul>

      {metrics.porPrefijo.length > 0 && (
        <>
          <h3 className="mb-2 text-xs font-bold text-[#0f1b2d]">Conexión por rango de número</h3>
          <ul className="space-y-1.5">
            {metrics.porPrefijo.map((p) => (
              <li key={p.prefijo} className="flex items-center justify-between text-xs">
                <span className="text-[#475569]">
                  Empieza en {p.prefijo}
                  {p.prefijo === "2" ? " (fijo)" : " (móvil)"}
                </span>
                <span className={p.tasa === 0 ? "font-semibold text-red-700" : "text-[#0f1b2d]"}>
                  {p.conectadas}/{p.total} ({fmtPorcentaje(p.tasa)})
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
