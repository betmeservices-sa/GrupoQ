"use client";

// La conversación que terminó en una reserva, en una ventana encima del tablero.
//
// Se abre desde "Quién cerró" y muestra la misma tanda que cuentan los números
// de esa fila: desde que arrancó hasta que se confirmó. Arriba, cuántos
// mensajes puso cada quien, que es lo que se quería saber ("cuánto fue Sofía y
// cuánto fue Vero").

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Autor = "huesped" | "agente" | "persona" | "equipo";

interface Mensaje {
  ts: string;
  texto: string;
  autor: Autor;
  nombre: string | null;
}

const TZ = "America/El_Salvador";

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-SV", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

/** Cómo se nombra a quien escribió, en el conteo y encima de cada mensaje. */
function quien(m: Mensaje): string {
  if (m.autor === "huesped") return "Huésped";
  if (m.autor === "equipo") return "Desde el celular";
  return m.nombre ?? "Equipo";
}

const ORDEN: Record<Autor, number> = { agente: 0, persona: 1, equipo: 2, huesped: 3 };

export function ConversacionCierre({
  cliente,
  clave,
  hasta,
  titulo,
  detalle,
  onCerrar,
}: {
  cliente: string;
  clave: string;
  hasta: string | null;
  titulo: string;
  detalle: string;
  onCerrar: () => void;
}) {
  const [mensajes, setMensajes] = useState<Mensaje[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    const q = new URLSearchParams({ cliente, clave });
    if (hasta) q.set("hasta", hasta);
    fetch(`/api/agencia/conversacion?${q}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok: boolean; mensajes?: Mensaje[]; error?: string }) => {
        if (!vivo) return;
        if (d.ok) setMensajes(d.mensajes ?? []);
        else setError(d.error ?? "No se pudo leer la conversación.");
      })
      .catch(() => {
        if (vivo) setError("No se pudo leer la conversación.");
      });
    return () => {
      vivo = false;
    };
  }, [cliente, clave, hasta]);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  const conteo = new Map<string, { autor: Autor; n: number }>();
  for (const m of mensajes ?? []) {
    const k = quien(m);
    const c = conteo.get(k) ?? { autor: m.autor, n: 0 };
    c.n += 1;
    conteo.set(k, c);
  }
  const chips = [...conteo.entries()].sort(([, a], [, b]) => ORDEN[a.autor] - ORDEN[b.autor]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10" onClick={onCerrar}>
      <div className="w-full max-w-xl rounded-2xl border border-line bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-bold text-[var(--text)]">{titulo}</h2>
            <p className="truncate text-[12px] text-[var(--text-3)]">{detalle}</p>
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1 text-[var(--text-3)] transition hover:bg-surface" aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3">
            {chips.map(([nombre, c]) => (
              <span
                key={nombre}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[12px] font-semibold",
                  c.autor === "agente" ? "bg-brand/10 text-brand" : c.autor === "huesped" ? "bg-surface text-[var(--text-3)]" : "bg-surface text-[var(--text)]",
                )}
              >
                {nombre} · {c.n}
              </span>
            ))}
          </div>
        )}

        <div className="max-h-[65vh] space-y-2.5 overflow-y-auto px-5 py-4">
          {error && <p className="text-[13px] text-[var(--text-3)]">{error}</p>}
          {!error && mensajes === null && (
            <p className="flex items-center gap-2 text-[13px] text-[var(--text-3)]">
              <Loader2 size={15} className="animate-spin text-brand" /> Leyendo la conversación
            </p>
          )}
          {mensajes?.length === 0 && <p className="text-[13px] text-[var(--text-3)]">No hay mensajes guardados de esta conversación.</p>}
          {mensajes?.map((m, i) => {
            const nuestro = m.autor !== "huesped";
            return (
              <div key={`${m.ts}-${i}`} className={cn("flex flex-col", nuestro ? "items-end" : "items-start")}>
                <p className="mb-0.5 text-[11px] text-[var(--text-3)]">
                  <span className={cn("font-semibold", m.autor === "agente" && "text-brand")}>{quien(m)}</span> · {fechaHora(m.ts)}
                </p>
                <p
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[13px] leading-snug text-[var(--text)]",
                    m.autor === "huesped" && "bg-surface",
                    m.autor === "agente" && "border border-brand/20 bg-brand/10",
                    m.autor === "persona" && "border border-line bg-card",
                    m.autor === "equipo" && "border border-dashed border-[var(--border-2)] bg-card",
                  )}
                >
                  {m.texto}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
