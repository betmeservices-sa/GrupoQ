"use client";

import { Clock, DollarSign, PhoneForwarded, PhoneIncoming, PhoneOutgoing, Timer } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { fmtDuracion, fmtPorcentaje, fmtUSD } from "@/lib/calls-format";
import type { CallMetrics } from "@/lib/data/types";

export function CallsKpis({ metrics }: { metrics: CallMetrics }) {
  // Si hay tarifa de carrier configurada, el costo mostrado es el real (Vapi +
  // carrier); si no, es solo el de Vapi. La etiqueta lo refleja.
  const hayCarrier = metrics.costoCarrier > 0;
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      <MetricCard label="Entrantes" valor={metrics.entrantes} Icon={PhoneIncoming} />
      <MetricCard label="Salientes" valor={metrics.salientes} Icon={PhoneOutgoing} />
      <MetricCard
        label="Tasa de conexión"
        valor={fmtPorcentaje(metrics.tasaConexion)}
        Icon={PhoneForwarded}
      />
      <MetricCard label="Minutos hablados" valor={metrics.minutosTotales} Icon={Timer} />
      <MetricCard
        label={hayCarrier ? "Costo real" : "Costo Vapi"}
        valor={fmtUSD(hayCarrier ? metrics.costoReal : metrics.costoTotal)}
        Icon={DollarSign}
      />
      <MetricCard label="Ring promedio" valor={fmtDuracion(metrics.ringPromedioSeg)} Icon={Clock} />
    </div>
  );
}
