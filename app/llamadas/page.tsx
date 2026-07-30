"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { CallsKpis } from "@/components/calls/CallsKpis";
import { CostBreakdown } from "@/components/calls/CostBreakdown";
import { LlamadasEnVivo } from "@/components/calls/LlamadasEnVivo";
import { OutcomePanel } from "@/components/calls/OutcomePanel";
import { ElevenLabsPanel } from "@/components/calls/ElevenLabsPanel";
import { CarrierPanel } from "@/components/calls/CarrierPanel";
import { CallsTable } from "@/components/calls/CallsTable";
import { PlanBucket } from "@/components/calls/PlanBucket";
import { categoriaOutcome, resumirLlamadas } from "@/lib/calls-metrics";
import { ETIQUETA_OUTCOME } from "@/lib/calls-format";
import { activeTenantId } from "@/lib/tenants/active";
import type { CallMetrics, CallOutcome, CallRecord } from "@/lib/data/types";

interface Respuesta {
  source: "vapi" | "demo";
  persistido: boolean;
  tarifaCarrier: number;
  metrics: CallMetrics;
  calls: CallRecord[];
  sincronizadaEn: string;
  errorVapi?: string;
  errorBase?: string;
}

// La vista se parte en dos: "Estadísticas" (historial, costos, tabla) y
// "En vivo" (lo que esta pasando ahora). Separarlas evita que la pagina de
// analisis se llene de informacion que cambia cada 6 segundos.
type Tab = "estadisticas" | "vivo";

type FiltroDir = "todas" | "inbound" | "outbound";
type FiltroOut = "todos" | CallOutcome;
// 0 = sin limite. Un selector de dias cubre el caso real (ver lo reciente) sin
// el peso de un date picker.
type FiltroDias = 0 | 1 | 7 | 30;

export default function LlamadasPage() {
  const [data, setData] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [tab, setTab] = useState<Tab>("estadisticas");
  const [dir, setDir] = useState<FiltroDir>("todas");
  const [out, setOut] = useState<FiltroOut>("todos");
  const [dias, setDias] = useState<FiltroDias>(0);
  // La agencia (miagentia) ve la vista completa con costos y desglose. Los
  // clientes (ej. hospital) ven una vista por PLAN: sin precios, sin carrier,
  // sin ElevenLabs, solo minutos del plan y el registro sin costo.
  const esAgencia = activeTenantId() === "miagentia";

  const sincronizar = useCallback(async (metodo: "GET" | "POST") => {
    setCargando(true);
    try {
      const res = await fetch("/api/calls", { method: metodo });
      setData((await res.json()) as Respuesta);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void sincronizar("GET");
  }, [sincronizar]);

  // Base de llamadas para el REPORTE. La agencia ve todo crudo. El cliente (ej.
  // hospital) ve solo las que conectaron (sin fallas de plataforma ni carrier) y
  // con el remitente y el agente normalizados a la marca para el demo.
  const baseCalls = useMemo(() => {
    if (!data) return [];
    if (esAgencia) return data.calls;
    return data.calls
      .filter((c) => {
        const o = categoriaOutcome(c.estadoFinal);
        return o !== "falla_carrier" && o !== "falla_plataforma";
      })
      .map((c) => ({
        ...c,
        nombreNumero: "MiAgentIA",
        numeroPropio: "MiAgentIA",
        phoneNumberId: undefined,
        nombreAssistant: "Sofia",
      }));
  }, [data, esAgencia]);

  // Metricas recalculadas sobre las llamadas ya filtradas (para la vista cliente).
  const metricsView = useMemo(() => {
    if (!data) return null;
    return esAgencia ? data.metrics : resumirLlamadas(baseCalls, data.tarifaCarrier);
  }, [data, esAgencia, baseCalls]);

  const visibles = useMemo(() => {
    if (!data) return [];
    const desde = dias > 0 ? Date.now() - dias * 24 * 60 * 60 * 1000 : null;
    return baseCalls.filter((c) => {
      if (dir !== "todas" && c.direccion !== dir) return false;
      if (out !== "todos" && categoriaOutcome(c.estadoFinal) !== out) return false;
      if (desde !== null) {
        const ts = c.creada ?? c.inicio;
        // Sin fecha no se puede ubicar en el rango: se excluye al filtrar.
        if (!ts || new Date(ts).getTime() < desde) return false;
      }
      return true;
    });
  }, [data, baseCalls, dir, out, dias]);

  return (
    // El <main> del AppShell es overflow-hidden: cada pagina scrollea por su
    // cuenta. Mismo patron que /dashboard: header fijo + cuerpo con overflow.
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Llamadas</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            {!data
              ? "Cargando..."
              : esAgencia
                ? `${data.source === "demo" ? "Datos de demostración" : "Datos reales de Vapi"}${
                    data.persistido
                      ? " con historial en base"
                      : " sin historial (Supabase no configurado)"
                  }`
                : "Registro de llamadas de tu línea de atención"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Las pestanas viven en el header para que el cuerpo scrollee limpio */}
          <div className="flex rounded-xl border border-line bg-surface p-0.5">
            {(
              [
                ["estadisticas", "Estadísticas"],
                ["vivo", "En vivo"],
              ] as Array<[Tab, string]>
            ).map(([id, texto]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={
                  tab === id
                    ? "rounded-[10px] bg-card px-3 py-1.5 text-xs font-semibold text-brand shadow-sm"
                    : "rounded-[10px] px-3 py-1.5 text-xs font-medium text-[var(--text-3)] hover:text-[var(--text)]"
                }
              >
                {texto}
              </button>
            ))}
          </div>

          {tab === "estadisticas" && (
            <button
              type="button"
              onClick={() => void sincronizar("POST")}
              disabled={cargando}
              className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs font-medium text-[var(--text)] hover:bg-surface disabled:opacity-50"
            >
              <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
              Sincronizar
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">

      {tab === "vivo" && <LlamadasEnVivo />}

      {tab === "estadisticas" && (
      <div className="space-y-5">

      {esAgencia && data?.errorVapi && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          <strong>No se pudo conectar con Vapi:</strong> {data.errorVapi}
          {data.calls.length > 0 && " Se muestra el último historial guardado."}
        </div>
      )}

      {esAgencia && data?.errorBase && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Las llamadas no se están guardando.</strong> Los datos de abajo son correctos y
          están en vivo, pero no queda historial.
          {data.errorBase.includes("public.calls") ? (
            <>
              {" "}
              Falta correr la migración <code>supabase/migrations/20260721000000_calls.sql</code> en
              este Supabase.
            </>
          ) : (
            <> Detalle: {data.errorBase}</>
          )}
        </div>
      )}

      {esAgencia && data && data.source === "demo" && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <strong>Estás viendo datos de ejemplo, no llamadas reales.</strong> Falta la variable{" "}
          <code>VAPI_PRIVATE_KEY</code> en este entorno.
        </div>
      )}

      {data && (
        <>
          {esAgencia ? (
            <>
              <CallsKpis metrics={data.metrics} />
              <div className="grid gap-4 lg:grid-cols-2">
                <CostBreakdown metrics={data.metrics} tarifaCarrier={data.tarifaCarrier} />
                <OutcomePanel metrics={data.metrics} />
                <CarrierPanel metrics={data.metrics} />
                <ElevenLabsPanel />
              </div>
            </>
          ) : (
            <PlanBucket metrics={metricsView ?? data.metrics} />
          )}

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              value={dir}
              onChange={(e) => setDir(e.target.value as FiltroDir)}
              className="rounded-lg border border-line bg-card px-2 py-1.5"
            >
              <option value="todas">Todas las direcciones</option>
              <option value="inbound">Entrantes</option>
              <option value="outbound">Salientes</option>
            </select>
            <select
              value={out}
              onChange={(e) => setOut(e.target.value as FiltroOut)}
              className="rounded-lg border border-line bg-card px-2 py-1.5"
            >
              <option value="todos">Todos los resultados</option>
              {(Object.keys(ETIQUETA_OUTCOME) as CallOutcome[])
                .filter((o) => esAgencia || (o !== "falla_carrier" && o !== "falla_plataforma"))
                .map((o) => (
                  <option key={o} value={o}>
                    {ETIQUETA_OUTCOME[o]}
                  </option>
                ))}
            </select>
            <select
              value={dias}
              onChange={(e) => setDias(Number(e.target.value) as FiltroDias)}
              className="rounded-lg border border-line bg-card px-2 py-1.5"
            >
              <option value={0}>Todo el historial</option>
              <option value={1}>Últimas 24 horas</option>
              <option value={7}>Últimos 7 días</option>
              <option value={30}>Últimos 30 días</option>
            </select>
            <span className="text-[var(--text-3)]">
              {visibles.length} de {baseCalls.length}
            </span>
          </div>

          <CallsTable calls={visibles} tarifaCarrier={data.tarifaCarrier} sinCosto={!esAgencia} />
          </>
        )}
      </div>
      )}
      </div>
    </div>
  );
}
