"use client";

// IA Performance: qué hizo el agente, no qué hizo la agencia.
//
// Grupo Q tiene su propio panel por la misma razón que Yali y la agencia
// tienen el suyo: las preguntas son distintas. Acá lo único que importa es el
// lead (cuántos entraron, a cuántos se les habló, cuántos contestaron) y lo que
// el agente consumió para lograrlo. Ni redes, ni costo de tokens, ni el detalle
// de llamadas: eso vive en sus propios módulos.

import { useEffect, useMemo, useState } from "react";
import { Mail, MessageSquare, PhoneOff, Timer, UserCheck, UserPlus, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { MetricCard } from "@/components/dashboard/MetricCard";
import type { EtapaId } from "@/lib/ventas-pipeline";
import type { RespuestaReporte } from "@/components/ventas/tipos";

/**
 * Los departamentos del panel, agrupados como los nombra Grupo Q.
 *
 * Es agrupación de PANTALLA: en la bandeja cada conversación sigue en su
 * departamento real. "Otros" se lleva todo lo que no es crédito ni atención,
 * que en un panel de crédito es exactamente lo que hay que poder ignorar.
 */
const GRUPOS: { label: string; color: string; deps: string[] | null }[] = [
  { label: "Créditos nuevos", color: "#006cb7", deps: ["crediq"] },
  { label: "Atención al cliente", color: "#64748b", deps: ["atencion", "recepcion"] },
  { label: "Seguimiento de créditos actuales", color: "#2baab1", deps: ["seguimiento", "financiamiento"] },
  { label: "Otros", color: "#94a3b8", deps: null },
];

/**
 * En qué está cada lead, con los nombres del negocio.
 *
 * Es una partición del embudo abierto: cada lead cae en una sola fila, así los
 * cinco números suman y no se pisan.
 */
const ESTADOS: { label: string; color: string; etapas: EtapaId[] }[] = [
  { label: "No contactados", color: "#94a3b8", etapas: ["asignadas"] },
  { label: "Contactados sin respuesta", color: "#f59e0b", etapas: ["sin_respuesta"] },
  { label: "Clientes interesados", color: "#0ea5e9", etapas: ["contactadas"] },
  { label: "Pendientes de documentación", color: "#0369a1", etapas: ["documentacion"] },
  { label: "Pendientes de aprobación de crédito", color: "#6366f1", etapas: ["evaluacion"] },
];

interface CallsResponse {
  source?: string;
  metrics?: { minutosTotales?: number };
}

/** Correos: el módulo no existe todavía, así que el número va rotulado. */
const CORREOS_DEMO = 128;

export function CrediqDashboard() {
  const { state } = useStore();
  const [reporte, setReporte] = useState<RespuestaReporte | null>(null);
  const [minutos, setMinutos] = useState<number | null>(null);
  const [vozEnVivo, setVozEnVivo] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/ventas/reporte?periodo=30d", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: RespuestaReporte) => {
        if (vivo && d.ok) setReporte(d);
      })
      .catch(() => undefined);
    fetch("/api/calls")
      .then((r) => r.json())
      .then((d: CallsResponse) => {
        if (!vivo) return;
        setMinutos(d.metrics?.minutosTotales ?? null);
        setVozEnVivo(d.source === "vapi");
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);

  const leads = useMemo(() => {
    const n = (etapas: EtapaId[]) =>
      (reporte?.embudo ?? []).filter((e) => etapas.includes(e.etapa)).reduce((s, e) => s + e.n, 0);
    const total = (reporte?.embudo ?? []).reduce((s, e) => s + e.n, 0);
    const sinContactar = n(["asignadas"]);
    const noContestaron = n(["sin_respuesta"]);
    return {
      entraron: total,
      contactados: total - sinContactar,
      contestaron: total - sinContactar - noContestaron,
      noContestaron,
    };
  }, [reporte]);

  // Mensajes que SALIERON por WhatsApp. Los que entran no son trabajo del
  // agente, son del cliente.
  const enviadosWa = useMemo(() => {
    const wa = new Set(
      state.conversations.filter((c) => c.canal === "whatsapp").map((c) => c.id),
    );
    return state.messages.filter((m) => m.autor === "staff" && wa.has(m.conversationId)).length;
  }, [state.conversations, state.messages]);

  const totalConv = state.conversations.length;
  const abiertos = ESTADOS.map((e) => ({
    ...e,
    n: (reporte?.embudo ?? []).filter((x) => e.etapas.includes(x.etapa)).reduce((s, x) => s + x.n, 0),
  }));
  const totalAbiertos = abiertos.reduce((s, e) => s + e.n, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-5 py-3">
        <h1 className="text-[17px] font-extrabold tracking-tight text-brand">IA Performance</h1>
        <p className="text-[12.5px] text-[var(--text-3)]">Qué hizo el agente con los leads de CrediQ</p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard label="Leads que entraron" valor={leads.entraron} Icon={UserPlus} />
          <MetricCard label="Contactados" valor={leads.contactados} Icon={Users} />
          <MetricCard label="Contestaron" valor={leads.contestaron} Icon={UserCheck} />
          <MetricCard label="No contestaron" valor={leads.noContestaron} Icon={PhoneOff} />
        </div>

        <section>
          <div className="mb-2 flex items-center gap-2.5">
            <h2 className="text-sm font-bold text-[var(--text)]">Consumo del agente</h2>
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                vozEnVivo ? "bg-emerald-50 text-[#2f9e2f]" : "bg-amber-50 text-[#b07d1a]"
              }`}
            >
              {vozEnVivo ? "Voz en vivo" : "Demo"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            <MetricCard
              label="Minutos de llamada"
              valor={minutos === null ? "—" : minutos}
              Icon={Timer}
            />
            <MetricCard label="Mensajes de WhatsApp enviados" valor={enviadosWa} Icon={MessageSquare} />
            <MetricCard label="Correos enviados" valor={CORREOS_DEMO} Icon={Mail} />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-[var(--text)]">Conversaciones por departamento</h2>
            <div className="space-y-3">
              {GRUPOS.map((g) => {
                const n = state.conversations.filter((c) =>
                  g.deps
                    ? g.deps.includes(c.departamento)
                    : !GRUPOS.some((o) => o.deps?.includes(c.departamento)),
                ).length;
                const pct = totalConv === 0 ? 0 : Math.round((n / totalConv) * 100);
                return (
                  <div key={g.label}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--text-2)]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
                        <span className="truncate">{g.label}</span>
                      </span>
                      <span className="shrink-0 font-bold text-[var(--text)]">{n}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: g.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-bold text-[var(--text)]">Estado de los leads</h2>
            <div className="space-y-3">
              {abiertos.map((e) => {
                const pct = totalAbiertos === 0 ? 0 : Math.round((e.n / totalAbiertos) * 100);
                return (
                  <div key={e.label}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-[12.5px]">
                      <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--text-2)]">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                        <span className="truncate">{e.label}</span>
                      </span>
                      <span className="shrink-0 font-bold text-[var(--text)]">
                        {e.n} <span className="text-[var(--text-3)]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: e.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
