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
      <h2 className="mb-4 text-sm font-bold text-[#0f1b2d]">Desglose de costo</h2>
      <ul className="space-y-3">
        {COMPONENTES.map(({ key, label }) => {
          const valor = metrics.desglose[key];
          const pct = (valor / total) * 100;
          return (
            <li key={key}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-[#475569]">{label}</span>
                <span className="font-semibold text-[#0f1b2d]">
                  {fmtUSD(valor)} <span className="text-[#94a3b4]">({pct.toFixed(0)}%)</span>
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-surface">
                <div className="h-1.5 rounded-full bg-brand" style={{ width: `${pct}%` }} />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-3 text-xs">
        <p className="mb-2 font-bold text-[#0f1b2d]">Costo por minuto</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[17px] font-extrabold text-[#0f1b2d]">
              {fmtUSD(metrics.costoFijoPorMin)}
            </p>
            <p className="text-[#94a3b4]">Agente (fijo: Vapi + STT). Tu tarifa estable.</p>
          </div>
          <div>
            <p className="text-[17px] font-extrabold text-[#0f1b2d]">
              + {fmtUSD(metrics.costoLlmPorMin)}
            </p>
            <p className="text-[#94a3b4]">LLM (variable: por token, según la conversación).</p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-surface p-3 text-xs">
        <div>
          <p className="font-semibold text-[#0f1b2d]">
            {metrics.caracteresTTS.toLocaleString("es-SV")}
          </p>
          <p className="text-[#94a3b4]">Caracteres de voz (ElevenLabs)</p>
        </div>
        <div>
          <p className="font-semibold text-[#0f1b2d]">
            {metrics.caracteresPorLlamada.toLocaleString("es-SV")}
          </p>
          <p className="text-[#94a3b4]">Promedio por llamada hablada</p>
        </div>
      </div>

      <div className="mt-3 rounded-xl bg-surface p-3 text-xs leading-relaxed text-[#475569]">
        {tarifaCarrier > 0 ? (
          <>
            Costo real estimado:{" "}
            <strong className="text-[#0f1b2d]">{fmtUSD(metrics.costoReal)}</strong> (Vapi{" "}
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
