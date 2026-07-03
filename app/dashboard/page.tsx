"use client";

import { useMemo } from "react";
import {
  Bot,
  CheckCircle2,
  Clock,
  Inbox,
  Megaphone,
  MessageSquare,
  Smile,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { activeTenant } from "@/lib/tenants/active";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DeptBreakdown } from "@/components/dashboard/DeptBreakdown";
import { CallsPanel } from "@/components/dashboard/CallsPanel";

// Íconos disponibles para las tarjetas del dashboard (referenciados por nombre
// desde la config del tenant).
const ICONS: Record<string, LucideIcon> = {
  MessageSquare,
  Megaphone,
  Clock,
  Timer,
  CheckCircle2,
  Smile,
  Bot,
  Inbox,
};

// Estados de conversación. Colores por CSS var para que sigan la marca del tenant.
const ESTADOS = [
  { id: "nuevo", label: "Nuevos", color: "var(--brand-accent)" },
  { id: "en_progreso", label: "En progreso", color: "#f5a623" },
  { id: "resuelto", label: "Resueltos", color: "var(--brand-green)" },
] as const;

export default function DashboardPage() {
  const { state } = useStore();
  const cards = activeTenant().dashboard;

  const stats = useMemo(() => {
    const total = state.conversations.length;
    const resueltas = state.conversations.filter((c) => c.estado === "resuelto").length;
    const sinAsignar = state.conversations.filter((c) => !c.asignadoA).length;
    const pct = total === 0 ? 0 : Math.round((resueltas / total) * 100);
    return { total, resueltas, sinAsignar, pct };
  }, [state.conversations]);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-5 py-3">
        <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Dashboard</h1>
        <p className="text-[12.5px] text-[#94a3b4]">Resumen de la actividad de comunicación</p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = ICONS[card.icon] ?? MessageSquare;
            if (card.kind === "resolucionPct") {
              return <MetricCard key={card.label} label={card.label} valor={`${stats.pct}%`} Icon={Icon} />;
            }
            if (card.kind === "sinAsignar") {
              return <MetricCard key={card.label} label={card.label} valor={stats.sinAsignar} Icon={Icon} />;
            }
            // kind "metric": valor de seed.metrics por label exacta.
            const metric = state.metrics.find((m) => m.label === card.metricLabel);
            return (
              <MetricCard
                key={card.label}
                label={card.label}
                valor={metric?.valor ?? card.fallback ?? "—"}
                delta={metric?.delta}
                Icon={Icon}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DeptBreakdown conversations={state.conversations} />

          <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-[#0f1b2d]">Estado de las conversaciones</h2>
            <div className="space-y-3">
              {ESTADOS.map((e) => {
                const n = state.conversations.filter((c) => c.estado === e.id).length;
                const pct = stats.total === 0 ? 0 : Math.round((n / stats.total) * 100);
                return (
                  <div key={e.id}>
                    <div className="mb-1 flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-2 font-medium text-[#5b6b80]">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: e.color }}
                        />
                        {e.label}
                      </span>
                      <span className="font-bold text-[#0f1b2d]">
                        {n} <span className="text-[#94a3b4]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: e.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <CallsPanel />
      </div>
    </div>
  );
}
