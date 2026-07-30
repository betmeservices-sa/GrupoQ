"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneIncoming, PhoneOutgoing, Radio } from "lucide-react";
import { cn } from "@/lib/cn";
import type { EstadoEnVivo, LlamadaEnCurso, ResumenPorNumero } from "@/lib/vapi-live";

// Cada cuanto se le pregunta al servidor. 6s es el punto donde se siente "en
// vivo" sin castigar la API de Vapi ni la cuota de la funcion serverless.
const INTERVALO_MS = 6000;

function cronometro(desde?: string, ahora = Date.now()): string {
  if (!desde) return "--:--";
  const seg = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 1000));
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function etiquetaEstado(l: LlamadaEnCurso): string {
  if (l.hablando) return "En conversación";
  if (l.estado === "ringing") return "Timbrando";
  if (l.estado === "queued") return "En cola";
  if (l.estado === "forwarding") return "Transfiriendo";
  return l.estado;
}

function Punto({ activo }: { activo: boolean }) {
  if (!activo) return <span className="h-2 w-2 rounded-full bg-[var(--text-3)] opacity-40" />;
  return (
    <span className="relative flex h-2 w-2">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  );
}

/** Totales arriba: cuantas hay y cuantas ya estan hablando. */
function Totales({ estado }: { estado: EstadoEnVivo | null }) {
  const total = estado?.total ?? 0;
  const hablando = estado?.hablando ?? 0;
  const esperando = Math.max(0, total - hablando);
  const hay = total > 0;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div
        className={cn(
          "rounded-2xl border p-4 shadow-sm",
          hay ? "border-emerald-200 bg-emerald-50/50" : "border-line bg-card",
        )}
      >
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              hay ? "bg-emerald-100 text-[#2f9e2f]" : "bg-[var(--surface-2)] text-[var(--text-3)]",
            )}
          >
            <Radio size={18} />
          </span>
          <Punto activo={hay} />
        </div>
        <p className="mt-3 text-[26px] font-extrabold leading-none tracking-tight text-[var(--text)]">
          {total}
        </p>
        <p className="mt-1.5 text-[12.5px] font-medium text-[var(--text-3)]">
          {total === 1 ? "Llamada activa" : "Llamadas activas"}
        </p>
      </div>

      <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Phone size={18} />
        </span>
        <p className="mt-3 text-[26px] font-extrabold leading-none tracking-tight text-[var(--text)]">
          {hablando}
        </p>
        <p className="mt-1.5 text-[12.5px] font-medium text-[var(--text-3)]">En conversación</p>
      </div>

      <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
          <PhoneIncoming size={18} />
        </span>
        <p className="mt-3 text-[26px] font-extrabold leading-none tracking-tight text-[var(--text)]">
          {esperando}
        </p>
        <p className="mt-1.5 text-[12.5px] font-medium text-[var(--text-3)]">Timbrando o en cola</p>
      </div>
    </div>
  );
}

/** Desglose por linea: que numero esta cargado ahora mismo. */
function PorNumero({ filas }: { filas: ResumenPorNumero[] }) {
  if (filas.length === 0) return null;
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <p className="text-[13px] font-bold text-[var(--text)]">Por número</p>
      <ul className="mt-2">
        {filas.map((f) => (
          <li
            key={f.phoneNumberId ?? f.numero}
            className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0"
          >
            <Punto activo={f.activas > 0} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-[var(--text)]">
                {f.nombre || f.numero}
              </p>
              {f.nombre && (
                <p className="truncate font-mono text-[11.5px] text-[var(--text-3)]">{f.numero}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p
                className={cn(
                  "text-[15px] font-extrabold tabular-nums leading-none",
                  f.activas > 0 ? "text-[#2f9e2f]" : "text-[var(--text-3)]",
                )}
              >
                {f.activas}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--text-3)]">
                {f.activas === 0
                  ? "sin llamadas"
                  : f.hablando === f.activas
                    ? "en conversación"
                    : `${f.hablando} hablando`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Detalle de cada llamada viva, con cronometro. */
function Detalle({ activas, ahora }: { activas: LlamadaEnCurso[]; ahora: number }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <p className="text-[13px] font-bold text-[var(--text)]">Llamadas en curso</p>
      {activas.length === 0 ? (
        <p className="mt-3 py-6 text-center text-[12.5px] text-[var(--text-3)]">
          No hay llamadas en este momento.
        </p>
      ) : (
        <ul className="mt-2">
          {activas.map((l) => {
            const Icono = l.direccion === "outbound" ? PhoneOutgoing : PhoneIncoming;
            return (
              <li
                key={l.id}
                className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0"
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    l.hablando ? "bg-emerald-50 text-[#2f9e2f]" : "bg-amber-50 text-amber-600",
                  )}
                >
                  <Icono size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-[var(--text)]">
                    {l.numeroCliente ?? "Número desconocido"}
                  </p>
                  <p className="truncate text-[11.5px] text-[var(--text-3)]">
                    {[l.nombreNumero, l.nombreAssistant].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[13.5px] font-bold tabular-nums text-[var(--text)]">
                    {cronometro(l.desde, ahora)}
                  </p>
                  <p className="text-[11px] text-[var(--text-3)]">{etiquetaEstado(l)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function LlamadasEnVivo() {
  const [estado, setEstado] = useState<EstadoEnVivo | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  // Se guarda el ultimo dato bueno: si una consulta falla, la vista sigue
  // mostrando lo anterior en vez de parpadear a cero.
  const ultimoBueno = useRef<EstadoEnVivo | null>(null);

  const consultar = useCallback(async () => {
    try {
      const res = await fetch("/api/calls/live", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as EstadoEnVivo;
      if (!data.error) ultimoBueno.current = data;
      setEstado(data.error && ultimoBueno.current ? ultimoBueno.current : data);
    } catch {
      // Silencioso a proposito: un corte puntual no debe ensuciar la UI.
    }
  }, []);

  useEffect(() => {
    consultar();
    const t = setInterval(consultar, INTERVALO_MS);
    return () => clearInterval(t);
  }, [consultar]);

  // Cronometro local por segundo, para que el tiempo avance suave entre
  // consultas en vez de saltar cada 6 segundos.
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12.5px] text-[var(--text-3)]">
          Se actualiza cada {INTERVALO_MS / 1000} segundos
          {estado?.consultadoEn && (
            <> · última consulta {new Date(estado.consultadoEn).toLocaleTimeString("es-SV")}</>
          )}
        </p>
        {estado?.fuente === "demo" && (
          <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--text-3)]">
            demo
          </span>
        )}
      </div>

      <Totales estado={estado} />

      <div className="grid gap-4 lg:grid-cols-2">
        <PorNumero filas={estado?.porNumero ?? []} />
        <Detalle activas={estado?.activas ?? []} ahora={ahora} />
      </div>
    </div>
  );
}
