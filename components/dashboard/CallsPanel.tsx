"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { MetricCard } from "./MetricCard";
import type { CallMetrics, CallRecord } from "@/lib/data/types";

interface CallsResponse {
  source: "vapi" | "demo" | "error";
  metrics: CallMetrics | null;
  calls: CallRecord[];
  error?: string;
}

function fmtDuracion(seg: number): string {
  if (!seg) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function fmtHora(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-SV", {
    timeZone: "America/El_Salvador",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ESTADO_LABEL: Record<string, string> = {
  "customer-ended-call": "Finalizada",
  "assistant-ended-call": "Finalizada",
  "assistant-forwarded-call": "Transferida",
  "customer-did-not-answer": "Sin respuesta",
};

function estadoLabel(reason?: string): string {
  if (!reason) return "—";
  return ESTADO_LABEL[reason] ?? reason.replace(/-/g, " ");
}

const DIR_META: Record<
  CallRecord["direccion"],
  { Icon: LucideIcon; color: string; label: string }
> = {
  inbound: { Icon: PhoneIncoming, color: "var(--brand-green)", label: "Entrante" },
  outbound: { Icon: PhoneOutgoing, color: "var(--brand-blue)", label: "Saliente" },
  web: { Icon: Phone, color: "#94a3b4", label: "Web" },
};

export function CallsPanel() {
  const [data, setData] = useState<CallsResponse | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");

  useEffect(() => {
    let activo = true;
    fetch("/api/calls")
      .then((r) => r.json())
      .then((d: CallsResponse) => {
        if (!activo) return;
        if (d.source === "error" || !d.metrics) {
          setData(d);
          setEstado("error");
        } else {
          setData(d);
          setEstado("listo");
        }
      })
      .catch(() => {
        if (activo) setEstado("error");
      });
    return () => {
      activo = false;
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-bold text-[#0f1b2d]">Llamadas</h2>
          {estado === "listo" && data && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                data.source === "vapi"
                  ? "bg-emerald-50 text-[#2f9e2f]"
                  : "bg-amber-50 text-[#b07d1a]"
              }`}
            >
              {data.source === "vapi" ? "En vivo · Vapi" : "Demo"}
            </span>
          )}
        </div>
        {estado === "listo" && data?.metrics && (
          <span className="text-[12px] text-[#94a3b4]">
            {data.metrics.entrantes} entrantes · {data.metrics.salientes} salientes
          </span>
        )}
      </div>

      {estado === "cargando" && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[104px] animate-pulse rounded-2xl border border-line bg-surface"
            />
          ))}
        </div>
      )}

      {estado === "error" && (
        <div className="rounded-2xl border border-line bg-card p-5 text-[13px] text-[#94a3b4]">
          No se pudieron cargar las llamadas{data?.error ? `: ${data.error}` : ""}.
        </div>
      )}

      {estado === "listo" && data?.metrics && (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard label="Llamadas" valor={data.metrics.total} Icon={Phone} />
            <MetricCard label="Entrantes" valor={data.metrics.entrantes} Icon={PhoneIncoming} />
            <MetricCard label="Minutos totales" valor={data.metrics.minutosTotales} Icon={Timer} />
            <MetricCard
              label="Duración promedio"
              valor={fmtDuracion(data.metrics.duracionPromedioSeg)}
              Icon={Clock}
            />
          </div>

          <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-[#0f1b2d]">Últimas llamadas</h3>
            {data.calls.length === 0 ? (
              <p className="text-[13px] text-[#94a3b4]">Aún no hay llamadas registradas.</p>
            ) : (
              <ul className="divide-y divide-line">
                {data.calls.map((c) => {
                  const { Icon, color, label } = DIR_META[c.direccion];
                  return (
                    <li key={c.id} className="flex items-center gap-3 py-2.5">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${color}1a`, color }}
                      >
                        <Icon size={16} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-[#0f1b2d]">
                          {c.numeroCliente ?? "Desconocido"}
                        </p>
                        <p className="text-[11.5px] text-[#94a3b4]">
                          {label} · {estadoLabel(c.estadoFinal)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[12.5px] font-bold text-[#0f1b2d]">
                          {fmtDuracion(c.duracionSeg)}
                        </p>
                        <p className="text-[11px] text-[#94a3b4]">{fmtHora(c.inicio)}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
