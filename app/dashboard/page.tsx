"use client";

import { useMemo } from "react";
import {
  Bot,
  CalendarCheck,
  CalendarSearch,
  CheckCircle2,
  Clock,
  HandCoins,
  Inbox,
  Megaphone,
  MessageSquare,
  PhoneCall,
  Smile,
  Timer,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { activeTenant, activeTenantId } from "@/lib/tenants/active";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DeptBreakdown } from "@/components/dashboard/DeptBreakdown";
import { CallsPanel } from "@/components/dashboard/CallsPanel";
import { HotelOcupacion } from "@/components/dashboard/HotelOcupacion";
import { YaliDashboard } from "@/components/dashboard/YaliDashboard";
import { AgenciaDashboard } from "@/components/dashboard/AgenciaDashboard";
import { OrigenCanales } from "@/components/dashboard/OrigenCanales";
import { ConsumoIA } from "@/components/dashboard/ConsumoIA";
import { RedesResumen } from "@/components/dashboard/RedesResumen";

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
  CalendarSearch,
  CalendarCheck,
  Users,
  PhoneCall,
  HandCoins,
  Wallet,
  TrendingUp,
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
  // El hotel es el único tenant con sistema de reservas conectado: su dashboard
  // suma la ocupación y las tarifas leídas en vivo.
  const esHotel = activeTenantId() === "hotel";
  // Yali Hospitality tiene tres sedes y su propio libro de ocupación: su panel
  // arma la foto de los tres hoteles juntos.
  const esYali = activeTenantId() === "yaly";
  // El banco es un centro de COBRANZA: no publica en redes, igual que en el menú.
  const veRedes = activeTenantId() !== "promerica";

  const stats = useMemo(() => {
    const total = state.conversations.length;
    const resueltas = state.conversations.filter((c) => c.estado === "resuelto").length;
    const sinAsignar = state.conversations.filter((c) => !c.asignadoA).length;
    const pct = total === 0 ? 0 : Math.round((resueltas / total) * 100);
    return { total, resueltas, sinAsignar, pct };
  }, [state.conversations]);

  // Yali tiene tablero propio: pestañas por hotel y las mismas cifras
  // separadas sede por sede. Se devuelve entero para no llenar esta pantalla de
  // condicionales. Va DESPUÉS de los hooks, que corren siempre.
  if (esYali) return <YaliDashboard />;
  // La agencia no mira su propia bandeja: mira a sus clientes.
  if (activeTenantId() === "miagentia") return <AgenciaDashboard />;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-5 py-3">
        <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Dashboard</h1>
        <p className="text-[12.5px] text-[var(--text-3)]">Resumen de la actividad de comunicación</p>
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

        <OrigenCanales conversations={state.conversations} />

        {veRedes && <RedesResumen />}

        {/* Lo que cuesta el agente de IA: tokens y dinero, texto e imágenes.
            Yali no llega hasta acá (tiene su propio tablero) y es a propósito: el
            consumo de tokens es cuenta nuestra, no del hotel. */}
        <ConsumoIA />

        {esHotel && <HotelOcupacion />}


        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DeptBreakdown conversations={state.conversations} />

          <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-[var(--text)]">Estado de las conversaciones</h2>
            <div className="space-y-3">
              {ESTADOS.map((e) => {
                const n = state.conversations.filter((c) => c.estado === e.id).length;
                const pct = stats.total === 0 ? 0 : Math.round((n / stats.total) * 100);
                return (
                  <div key={e.id}>
                    <div className="mb-1 flex items-center justify-between text-[12.5px]">
                      <span className="flex items-center gap-2 font-medium text-[var(--text-2)]">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: e.color }}
                        />
                        {e.label}
                      </span>
                      <span className="font-bold text-[var(--text)]">
                        {n} <span className="text-[var(--text-3)]">({pct}%)</span>
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

        {/* El panel de llamadas lee una central de voz que no es del hotel: en su
            dashboard no va, para no mostrarle actividad de otra cuenta. */}
        {!esHotel && <CallsPanel />}
      </div>
    </div>
  );
}
