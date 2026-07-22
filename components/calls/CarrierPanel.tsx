"use client";

import { PhoneCall } from "lucide-react";
import { fmtUSD } from "@/lib/calls-format";
import type { CallMetrics } from "@/lib/data/types";

export function CarrierPanel({ metrics }: { metrics: CallMetrics }) {
  const b = metrics.carrierBucket;
  const pct =
    b.bucketMin > 0 ? Math.min(100, (Math.min(b.minutosTotales, b.bucketMin) / b.bucketMin) * 100) : 0;
  const totalConTigo = Math.round((metrics.costoTotal + b.costoCarrier) * 10000) / 10000;
  const faltan = Math.max(0, Math.round((b.bucketMin - b.minutosTotales) * 10) / 10);

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <PhoneCall size={16} />
        </span>
        <h2 className="text-sm font-bold text-[#0f1b2d]">Telefonía (Tigo)</h2>
      </div>

      <div className="mb-1 flex items-end justify-between">
        <p className="text-[26px] font-extrabold leading-none text-[#0f1b2d]">
          {b.minutosTotales}
          <span className="text-sm font-medium text-[#94a3b4]"> / {b.bucketMin} min</span>
        </p>
        <span className="text-xs text-[#94a3b4]">bucket incluido</span>
      </div>
      <div className="h-2 w-full rounded-full bg-surface">
        <div
          className={`h-2 rounded-full ${b.minutosFueraBucket > 0 ? "bg-amber-500" : "bg-brand"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-[#94a3b4]">
        {b.minutosFueraBucket > 0
          ? `${b.minutosFueraBucket} min fuera del bucket (se cobran)`
          : `Faltan ${faltan} min para empezar a cobrar`}
      </p>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#475569]">Red fija (empieza en 2) · 2¢/min</span>
          <span className="font-semibold text-[#0f1b2d]">
            {b.fijaMin} min · {fmtUSD(b.fijaCosto)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[#475569]">Celulares (empieza en 6/7) · 8¢/min</span>
          <span className="font-semibold text-[#0f1b2d]">
            {b.celularMin} min · {fmtUSD(b.celularCosto)}
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-surface p-3 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-[#475569]">Costo Tigo (fuera del bucket)</span>
          <span className="font-bold text-[#0f1b2d]">{fmtUSD(b.costoCarrier)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[#475569]">Total con Tigo (Vapi + telefonía)</span>
          <span className="font-bold text-[#0f1b2d]">{fmtUSD(totalConTigo)}</span>
        </div>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[#94a3b4]">
        Los primeros {b.bucketMin} min van incluidos. Pasado eso: fija a 2¢, celular a 8¢ por
        minuto, según el número. La fija on-net es gratis, pero no se puede distinguir por el
        número, así que se cobra plano.
      </p>
    </div>
  );
}
