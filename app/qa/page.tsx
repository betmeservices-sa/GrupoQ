"use client";

// QA: escuchar lo que dijo el agente.
//
// Un tablero de métricas dice cuántas llamadas hubo; no dice si estuvieron
// bien. Para eso hay que oírlas, y oírlas tiene que costar un clic: por eso el
// reproductor va montado en la fila y no detrás de un enlace.
//
// El audio NO sale del bucket de Vapi. Sale de /api/calls/[id]/grabacion, que
// pide una URL firmada fresca en cada reproducción: la pública de Vapi
// responde 400 y la firmada caduca a las pocas horas.

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronRight, Loader2, MicOff, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { telefonoBonito } from "@/lib/phone";
import type { CallRecord } from "@/lib/data/types";

interface Respuesta {
  source: "vapi" | "demo" | "error";
  calls?: CallRecord[];
  error?: string;
}

function duracion(seg: number): string {
  if (!seg) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

function cuando(iso: string | undefined): string {
  if (!iso) return "";
  // La base guarda en UTC y El Salvador va seis horas atrás: sin esto una
  // llamada de la tarde aparece de noche.
  return new Date(iso).toLocaleString("es-SV", {
    timeZone: "America/El_Salvador",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function QAPage() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [estado, setEstado] = useState<"cargando" | "listo" | "error">("cargando");
  const [busca, setBusca] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/calls", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Respuesta) => {
        if (!vivo) return;
        setDatos(d);
        setEstado(d.source === "error" ? "error" : "listo");
      })
      .catch(() => vivo && setEstado("error"));
    return () => {
      vivo = false;
    };
  }, []);

  // Solo lo que dejó audio: una llamada que no timbró no se puede revisar.
  const llamadas = useMemo(() => {
    const todas = (datos?.calls ?? []).filter((c) => c.grabacionUrl);
    const q = busca.trim().toLowerCase();
    if (!q) return todas;
    return todas.filter(
      (c) =>
        (c.numeroCliente ?? "").includes(q) ||
        (c.nombreAssistant ?? "").toLowerCase().includes(q) ||
        (c.transcript ?? "").toLowerCase().includes(q),
    );
  }, [datos, busca]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-card px-5 py-3">
        <div className="min-w-0">
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">QA</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">Grabaciones y transcripciones de las llamadas</p>
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5">
          <Search size={14} className="text-[var(--text-3)]" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Número, agente o palabra dicha"
            className="w-[230px] bg-transparent text-[12.5px] outline-none placeholder:text-[var(--text-3)]"
          />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-5">
        {estado === "cargando" && (
          <p className="flex items-center gap-2 text-[13px] text-[var(--text-3)]">
            <Loader2 size={15} className="animate-spin text-brand" /> Trayendo las llamadas
          </p>
        )}

        {estado === "error" && (
          <p className="flex items-center gap-2 rounded-xl border border-[var(--brand-red)]/40 bg-[var(--brand-red)]/5 px-3 py-2 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={15} className="text-[var(--brand-red)]" />
            {datos?.error ?? "No se pudieron traer las llamadas."}
          </p>
        )}

        {estado === "listo" && llamadas.length === 0 && (
          <p className="flex items-center gap-2 text-[13px] text-[var(--text-3)]">
            <MicOff size={15} />
            {busca ? "Ninguna llamada calza con esa búsqueda." : "Todavía no hay llamadas con grabación."}
          </p>
        )}

        <div className="space-y-2">
          {llamadas.map((c) => {
            const activa = abierta === c.id;
            return (
              <article key={c.id} className="rounded-2xl border border-line bg-card p-3.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[13px] font-bold text-[var(--text)]">
                    {c.numeroCliente ? telefonoBonito(c.numeroCliente) : "Sin número"}
                  </span>
                  <span className="text-[11.5px] text-[var(--text-3)]">{cuando(c.inicio ?? c.creada)}</span>
                  <span className="text-[11.5px] text-[var(--text-2)]">{duracion(c.duracionSeg)}</span>
                  {c.nombreAssistant && (
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-bold text-brand">
                      {c.nombreAssistant}
                    </span>
                  )}
                  {c.transcript && (
                    <button
                      type="button"
                      onClick={() => setAbierta(activa ? null : c.id)}
                      className="ml-auto flex items-center gap-1 text-[11.5px] font-semibold text-[var(--text-2)] hover:text-[var(--text)]"
                    >
                      Transcripción
                      <ChevronRight
                        size={13}
                        className={cn("transition-transform duration-200", activa && "rotate-90")}
                      />
                    </button>
                  )}
                </div>

                {/* preload="none": con veinte llamadas en pantalla, precargar el
                    audio de todas es medio giga de descarga que nadie pidió. */}
                <audio
                  controls
                  preload="none"
                  src={c.grabacionUrl}
                  className="mt-2 h-9 w-full"
                >
                  Tu navegador no puede reproducir este audio.
                </audio>

                {c.transcript && (
                  <div className="ccg-desplegar" data-abierto={activa ? "true" : "false"}>
                    <div>
                      <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-surface p-3 text-[11.5px] leading-relaxed text-[var(--text-2)]">
                        {c.transcript}
                      </pre>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
