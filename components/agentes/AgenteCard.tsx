"use client";

import { FileText, Phone, PhoneOff, Settings2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { AgenteRecord } from "@/lib/vapi";

// Varios assistants traen el firstMessage ya entrecomillado desde Vapi. Como la
// tarjeta le pone sus propias comillas, sin esto se ve doble ("" ... "").
function sinComillas(s: string): string {
  return s.trim().replace(/^["“”']+/, "").replace(/["“”']+$/, "").trim();
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/).filter((x) => /[a-zA-ZÀ-ÿ]/.test(x));
  if (p.length === 0) return "AG";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[1][0]).toUpperCase();
}

// Tono estable por agente: el mismo nombre da siempre el mismo color, asi la
// grilla se vuelve reconocible de un vistazo sin pedirle nada al usuario.
function tono(nombre: string): number {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = (h * 31 + nombre.charCodeAt(i)) % 360;
  return h;
}

export function AgenteCard({
  agente,
  onAbrir,
}: {
  agente: AgenteRecord;
  onAbrir: (seccion: "script" | "numeros" | "llamar") => void;
}) {
  const activo = agente.numeros.length > 0;
  const h = tono(agente.nombre);

  return (
    <article className="group flex flex-col rounded-2xl border border-line bg-card shadow-sm transition hover:border-[var(--border-2)] hover:shadow-md">
      <div className="flex items-start gap-3 p-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[13px] font-extrabold tracking-tight"
          style={{
            backgroundColor: `hsl(${h} 72% 95%)`,
            color: `hsl(${h} 55% 34%)`,
          }}
        >
          {iniciales(agente.nombre)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-[14px] font-bold leading-tight text-[var(--text)]">
              {agente.nombre}
            </h2>
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                activo ? "bg-emerald-500" : "bg-amber-400",
              )}
              title={activo ? "Con número asignado" : "Sin número"}
            />
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-[var(--text-3)]">
            {[agente.modelo, agente.voz].filter(Boolean).join(" · ") || "Agente de voz"}
          </p>
        </div>
      </div>

      {/* El numero es lo que define si el agente sirve o no, asi que va grande
          y clickeable, no escondido en una lista. */}
      <button
        type="button"
        onClick={() => onAbrir("numeros")}
        className={cn(
          "mx-4 flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition",
          activo
            ? "border-line bg-surface hover:border-brand"
            : "border-dashed border-amber-300 bg-amber-50/50 hover:border-amber-400",
        )}
      >
        {activo ? (
          <Phone size={14} className="shrink-0 text-[#2f9e2f]" />
        ) : (
          <PhoneOff size={14} className="shrink-0 text-amber-600" />
        )}
        <span className="min-w-0 flex-1">
          {activo ? (
            <>
              <span className="block truncate font-mono text-[13px] font-bold text-[var(--text)]">
                {agente.numeros[0].numero}
              </span>
              <span className="block truncate text-[11px] text-[var(--text-3)]">
                {agente.numeros.length > 1
                  ? `y ${agente.numeros.length - 1} número${agente.numeros.length > 2 ? "s" : ""} más`
                  : agente.numeros[0].nombre || "Número asignado"}
              </span>
            </>
          ) : (
            <>
              <span className="block text-[12.5px] font-semibold text-amber-800">Sin número</span>
              <span className="block text-[11px] text-amber-700/80">
                No puede recibir ni hacer llamadas
              </span>
            </>
          )}
        </span>
        <Settings2
          size={14}
          className="shrink-0 text-[var(--text-3)] opacity-0 transition group-hover:opacity-100"
        />
      </button>

      {agente.primerMensaje ? (
        <p className="line-clamp-2 px-4 pt-3 text-[11.5px] italic leading-relaxed text-[var(--text-2)]">
          “{sinComillas(agente.primerMensaje)}”
        </p>
      ) : (
        <p className="px-4 pt-3 text-[11.5px] text-[var(--text-3)]">Sin mensaje de apertura</p>
      )}

      <div className="mt-auto flex items-center gap-2 p-4 pt-3">
        <button
          type="button"
          onClick={() => onAbrir("script")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-[12px] font-medium text-[var(--text-2)] transition hover:bg-surface"
        >
          <FileText size={13} />
          Script
        </button>
        <button
          type="button"
          onClick={() => onAbrir("llamar")}
          disabled={!activo}
          title={activo ? undefined : "Necesita un número asignado"}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-2.5 py-2 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Phone size={13} />
          Llamar
        </button>
      </div>
    </article>
  );
}
