"use client";

import { fmtUSD } from "@/lib/calls-format";
import type { CallMetrics } from "@/lib/data/types";

const COMPONENTES = [
  { key: "vapi", label: "Plataforma Vapi" },
  { key: "llm", label: "Modelo (LLM)" },
  { key: "stt", label: "Transcripción (STT)" },
  { key: "tts", label: "Voz (TTS)" },
  { key: "transport", label: "Transporte" },
] as const;

export function CostBreakdown({
  metrics,
  tarifaCarrier,
}: {
  metrics: CallMetrics;
  tarifaCarrier: number;
}) {
  const total = metrics.desglose.total || 1;

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-bold text-[var(--text)]">Desglose de costo</h2>
      <ul className="space-y-3">
        {COMPONENTES.map(({ key, label }) => {
          const valor = metrics.desglose[key];
          const pct = (valor / total) * 100;
          return (
            <li key={key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[var(--text-2)]">{label}</span>
                <span className="font-semibold text-[var(--text)]">
                  {fmtUSD(valor)} <span className="text-[var(--text-3)]">({pct.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface">
                <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-surface p-3 text-xs">
        <div>
          <p className="font-semibold text-[var(--text)]">
            {metrics.caracteresTTS.toLocaleString("es-SV")}
          </p>
          <p className="text-[var(--text-3)]">Caracteres de voz (ElevenLabs)</p>
        </div>
        <div>
          <p className="font-semibold text-[var(--text)]">
            {metrics.caracteresPorLlamada.toLocaleString("es-SV")}
          </p>
          <p className="text-[var(--text-3)]">Promedio por llamada hablada</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-surface p-3 text-xs leading-relaxed text-[var(--text-2)]">
        {tarifaCarrier > 0 ? (
          <>
            Costo real estimado:{" "}
            <strong className="text-[var(--text)]">{fmtUSD(metrics.costoReal)}</strong> (Vapi{" "}
            {fmtUSD(metrics.costoTotal)} + carrier {fmtUSD(metrics.costoCarrier)} a{" "}
            {fmtUSD(tarifaCarrier)}/min).
          </>
        ) : (
          <>
            Este costo es <strong>solo el de Vapi</strong>. El transporte llega en cero porque el
            trunk es propio, así que lo que cobra el carrier no está incluido. Configura{" "}
            <code>CARRIER_RATE_PER_MINUTE</code> para ver el costo real.
          </>
        )}
      </div>
    </div>
  );
}
