"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { CallsKpis } from "@/components/calls/CallsKpis";
import { CostBreakdown } from "@/components/calls/CostBreakdown";
import { OutcomePanel } from "@/components/calls/OutcomePanel";
import { ElevenLabsPanel } from "@/components/calls/ElevenLabsPanel";
import { CallsTable } from "@/components/calls/CallsTable";
import { categoriaOutcome } from "@/lib/calls-metrics";
import { ETIQUETA_OUTCOME } from "@/lib/calls-format";
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

type FiltroDir = "todas" | "inbound" | "outbound";
type FiltroOut = "todos" | CallOutcome;
// 0 = sin limite. Un selector de dias cubre el caso real (ver lo reciente) sin
// el peso de un date picker.
type FiltroDias = 0 | 1 | 7 | 30;

export default function LlamadasPage() {
  const [data, setData] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [dir, setDir] = useState<FiltroDir>("todas");
  const [out, setOut] = useState<FiltroOut>("todos");
  const [dias, setDias] = useState<FiltroDias>(0);

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

  const visibles = useMemo(() => {
    if (!data) return [];
    const desde = dias > 0 ? Date.now() - dias * 24 * 60 * 60 * 1000 : null;
    return data.calls.filter((c) => {
      if (dir !== "todas" && c.direccion !== dir) return false;
      if (out !== "todos" && categoriaOutcome(c.estadoFinal) !== out) return false;
      if (desde !== null) {
        const ts = c.creada ?? c.inicio;
        // Sin fecha no se puede ubicar en el rango: se excluye al filtrar.
        if (!ts || new Date(ts).getTime() < desde) return false;
      }
      return true;
    });
  }, [data, dir, out, dias]);

  return (
    // El <main> del AppShell es overflow-hidden: cada pagina scrollea por su
    // cuenta. Mismo patron que /dashboard: header fijo + cuerpo con overflow.
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Llamadas</h1>
          <p className="text-[12.5px] text-[#94a3b4]">
            {data
              ? `${data.source === "demo" ? "Datos de demostración" : "Datos reales de Vapi"}${
                  data.persistido
                    ? " con historial en base"
                    : " sin historial (Supabase no configurado)"
                }`
              : "Cargando..."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void sincronizar("POST")}
          disabled={cargando}
          className="flex items-center gap-2 rounded-xl border border-line bg-card px-3 py-2 text-xs font-medium text-[#0f1b2d] hover:bg-surface disabled:opacity-50"
        >
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          Sincronizar
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">

      {data?.errorVapi && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900">
          <strong>No se pudo conectar con Vapi:</strong> {data.errorVapi}
          {data.calls.length > 0 && " Se muestra el último historial guardado."}
        </div>
      )}

      {data?.errorBase && (
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

      {data && data.source === "demo" && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs text-sky-900">
          <strong>Estás viendo datos de ejemplo, no llamadas reales.</strong> Falta la variable{" "}
          <code>VAPI_PRIVATE_KEY</code> en este entorno.
        </div>
      )}

      {data && (
        <>
          <CallsKpis metrics={data.metrics} />

          <div className="grid gap-4 lg:grid-cols-3">
            <CostBreakdown metrics={data.metrics} tarifaCarrier={data.tarifaCarrier} />
            <OutcomePanel metrics={data.metrics} />
            <ElevenLabsPanel />
          </div>

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
              {(Object.keys(ETIQUETA_OUTCOME) as CallOutcome[]).map((o) => (
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
            <span className="text-[#94a3b4]">
              {visibles.length} de {data.calls.length}
            </span>
          </div>

          <CallsTable calls={visibles} tarifaCarrier={data.tarifaCarrier} />
          </>
        )}
      </div>
    </div>
  );
}
