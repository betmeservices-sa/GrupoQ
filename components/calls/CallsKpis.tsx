"use client";

import { Clock, DollarSign, Phone, PhoneForwarded, Timer } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { fmtDuracion, fmtPorcentaje, fmtUSD } from "@/lib/calls-format";
import type { CallMetrics } from "@/lib/data/types";

export function CallsKpis({ metrics }: { metrics: CallMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <MetricCard label="Llamadas" valor={metrics.total} Icon={Phone} />
      <MetricCard
        label="Tasa de conexión"
        valor={fmtPorcentaje(metrics.tasaConexion)}
        Icon={PhoneForwarded}
      />
      <MetricCard label="Minutos hablados" valor={metrics.minutosTotales} Icon={Timer} />
      <MetricCard label="Costo Vapi" valor={fmtUSD(metrics.costoTotal)} Icon={DollarSign} />
      <MetricCard label="Ring promedio" valor={fmtDuracion(metrics.ringPromedioSeg)} Icon={Clock} />
    </div>
  );
}
