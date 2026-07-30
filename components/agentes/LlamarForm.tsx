"use client";

import { useState } from "react";
import { AlertTriangle, Check, Phone, TriangleAlert } from "lucide-react";
import { destinoRiesgoso, normalizarDestinoSV } from "@/lib/phone";
import type { NumeroAsignado } from "@/lib/vapi";

type Estado =
  | { fase: "idle" }
  | { fase: "marcando" }
  | { fase: "ok"; id: string; numero: string; aviso?: string }
  | { fase: "error"; error: string };

export function LlamarForm({
  assistantId,
  numeros,
}: {
  assistantId: string;
  numeros: NumeroAsignado[];
}) {
  const [destino, setDestino] = useState("");
  const [desdeId, setDesdeId] = useState(numeros[0]?.id ?? "");
  const [estado, setEstado] = useState<Estado>({ fase: "idle" });

  // Sin numero asignado Vapi no deja marcar: se dice, no se esconde el porque.
  if (numeros.length === 0) {
    return (
      <p className="flex items-start gap-2 rounded-xl bg-surface p-3 text-[11px] text-[var(--text-3)]">
        <AlertTriangle size={14} className="mt-px shrink-0" />
        Este agente no tiene número asignado, así que no puede hacer llamadas salientes. Asignale uno
        en Vapi para habilitar el marcado.
      </p>
    );
  }

  const e164 = normalizarDestinoSV(destino);
  const valido = e164 !== null;
  const riesgoso = valido && destinoRiesgoso(e164);
  const marcando = estado.fase === "marcando";

  async function marcar() {
    if (!e164) return;
    setEstado({ fase: "marcando" });
    try {
      const res = await fetch("/api/agentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId, phoneNumberId: desdeId, numero: e164 }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        id?: string;
        error?: string;
        aviso?: string;
      };
      if (!res.ok || !data.ok) {
        setEstado({ fase: "error", error: data.error ?? `Vapi respondió ${res.status}` });
        return;
      }
      setEstado({ fase: "ok", id: data.id ?? "", numero: e164, aviso: data.aviso });
      setDestino("");
    } catch (err) {
      setEstado({ fase: "error", error: err instanceof Error ? err.message : "Error de red" });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {numeros.length > 1 && (
          <select
            value={desdeId}
            onChange={(e) => setDesdeId(e.target.value)}
            className="rounded-lg border border-line bg-card px-2 py-1.5 text-xs"
            aria-label="Número desde el que se marca"
          >
            {numeros.map((n) => (
              <option key={n.id} value={n.id}>
                {n.nombre || n.numero}
              </option>
            ))}
          </select>
        )}
        <input
          value={destino}
          onChange={(e) => {
            setDestino(e.target.value);
            if (estado.fase !== "idle") setEstado({ fase: "idle" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && valido && !marcando) void marcar();
          }}
          inputMode="tel"
          placeholder="7539 1721"
          aria-label="Número a llamar"
          className="w-36 rounded-lg border border-line bg-card px-2 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={() => void marcar()}
          disabled={!valido || marcando}
          className="flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          <Phone size={13} />
          {marcando ? "Marcando..." : "Llamar"}
        </button>
        {destino.length > 0 && !valido && (
          <span className="text-[11px] text-[var(--text-3)]">8 dígitos de El Salvador</span>
        )}
      </div>

      {riesgoso && estado.fase === "idle" && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
          <TriangleAlert size={13} className="mt-px shrink-0" />
          El rango 6 no está terminando por el trunk (SIP 480). La llamada se va a crear pero es muy
          probable que no timbre.
        </p>
      )}

      {estado.fase === "ok" && (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-[11px] text-emerald-900">
          <Check size={13} className="mt-px shrink-0" />
          <span>
            Llamada creada a <strong>{estado.numero}</strong>. Aparece en Llamadas al sincronizar.
            {estado.aviso && <> {estado.aviso}</>}
          </span>
        </p>
      )}

      {estado.fase === "error" && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-2 text-[11px] text-red-900">
          No se pudo marcar: {estado.error}
        </p>
      )}
    </div>
  );
}
