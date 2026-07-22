"use client";

import { useEffect, useState } from "react";
import { Mic } from "lucide-react";
import type { CuotaEleven } from "@/lib/elevenlabs";

interface Respuesta {
  configurado: boolean;
  cuota: CuotaEleven | null;
  error?: string;
}

function fmtNum(n: number): string {
  return n.toLocaleString("es-SV");
}

function fmtFecha(unix: number | null): string {
  if (!unix) return "sin fecha";
  return new Date(unix * 1000).toLocaleDateString("es-SV", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ElevenLabsPanel() {
  const [data, setData] = useState<Respuesta | null>(null);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/elevenlabs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelado) setData(d);
      })
      .catch(() => {
        if (!cancelado) setData(null);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Mic size={16} />
        </span>
        <h2 className="text-sm font-bold text-[#0f1b2d]">Voz (ElevenLabs)</h2>
      </div>

      {!data && <p className="text-xs text-[#94a3b4]">Cargando cuota de voz...</p>}

      {data && !data.configurado && (
        <p className="text-xs text-[#94a3b4]">
          Cuota no disponible: falta <code>ELEVENLABS_API_KEY</code> en este entorno.
        </p>
      )}

      {data && data.configurado && !data.cuota && (
        <p className="text-xs text-amber-700">
          No se pudo leer la cuota de ElevenLabs{data.error ? ` (${data.error})` : ""}.
        </p>
      )}

      {data?.cuota && (
        <>
          <div className="mb-2 flex items-end justify-between">
            <div>
              <p className="text-[26px] font-extrabold leading-none tracking-tight text-[#0f1b2d]">
                {fmtNum(data.cuota.usados)}
              </p>
              <p className="mt-1 text-xs text-[#94a3b4]">
                de {fmtNum(data.cuota.limite)} caracteres usados
              </p>
            </div>
            <span className="text-sm font-bold text-[#0f1b2d]">
              {(data.cuota.porcentaje * 100).toFixed(1)}%
            </span>
          </div>

          <div className="h-2 w-full rounded-full bg-surface">
            <div
              className={`h-2 rounded-full ${
                data.cuota.porcentaje >= 0.9
                  ? "bg-red-500"
                  : data.cuota.porcentaje >= 0.75
                    ? "bg-amber-500"
                    : "bg-brand"
              }`}
              style={{ width: `${Math.min(100, data.cuota.porcentaje * 100)}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-semibold text-[#0f1b2d]">{fmtNum(data.cuota.restantes)}</p>
              <p className="text-[#94a3b4]">Caracteres restantes</p>
            </div>
            <div>
              <p className="font-semibold text-[#0f1b2d]">{fmtFecha(data.cuota.reinicioUnix)}</p>
              <p className="text-[#94a3b4]">Reinicio de cuota</p>
            </div>
          </div>

          <p className="mt-3 rounded-xl bg-surface p-2 text-[11px] text-[#94a3b4]">
            Plan {data.cuota.tier}. Si esta cuota se agota, las llamadas fallan con voz. Ya pasó el
            9 de julio.
          </p>
        </>
      )}
    </div>
  );
}
