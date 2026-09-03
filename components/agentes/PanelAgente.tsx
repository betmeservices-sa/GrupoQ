"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Phone, Trash2, X } from "lucide-react";
import { LlamarForm } from "./LlamarForm";
import { cn } from "@/lib/cn";
import type { AgenteRecord, NumeroRecord } from "@/lib/vapi";

type Seccion = "script" | "numeros" | "llamar";

/**
 * Panel lateral con todo lo que antes vivia apilado dentro de la tarjeta.
 * Sacarlo de ahi es el punto: la grilla queda escaneable y el trabajo pesado
 * (editar un prompt de miles de caracteres) tiene el espacio que necesita.
 */
export function PanelAgente({
  agente,
  numeros,
  seccionInicial,
  onCerrar,
  onCambio,
  modoCliente = false,
}: {
  agente: AgenteRecord;
  numeros: NumeroRecord[];
  seccionInicial: Seccion;
  onCerrar: () => void;
  onCambio: () => void;
  modoCliente?: boolean;
}) {
  const [seccion, setSeccion] = useState<Seccion>(modoCliente ? "llamar" : seccionInicial);

  // Escape cierra: en un panel modal es lo que la gente intenta primero.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 bg-black/25 backdrop-blur-[2px]"
      />
      <aside className="relative flex h-full w-full max-w-2xl flex-col border-l border-line bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-extrabold tracking-tight text-[var(--text)]">
              {agente.nombre}
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
              {modoCliente
                ? "Agente de voz"
                : [agente.modelo, agente.voz].filter(Boolean).join(" · ") || "Agente de voz"}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1.5 text-[var(--text-3)] transition hover:bg-surface hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </header>

        <nav className={cn("flex gap-1 border-b border-line px-4 pt-2", modoCliente && "hidden")}>
          {(
            [
              ["script", "Script"],
              ["numeros", "Números"],
              ["llamar", "Probar llamada"],
            ] as Array<[Seccion, string]>
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSeccion(id)}
              className={cn(
                "relative px-3 pb-2.5 pt-1 text-[13px] transition",
                seccion === id
                  ? "font-semibold text-brand after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand"
                  : "font-medium text-[var(--text-3)] hover:text-[var(--text)]",
              )}
            >
              {texto}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto p-5">
          {seccion === "script" && <EditorScript agente={agente} />}
          {seccion === "numeros" && (
            <GestorNumeros agente={agente} numeros={numeros} onCambio={onCambio} />
          )}
          {seccion === "llamar" && (
            <div className="space-y-3">
              <p className="text-[12.5px] text-[var(--text-3)]">
                {modoCliente
                  ? "El agente marca de verdad y consume minutos del plan. El destino debe ser de El Salvador, 8 dígitos."
                  : "Se marca de verdad y consume minutos. El destino debe ser de El Salvador, 8 dígitos."}
              </p>
              {/* Para SALIR no hace falta que la linea sea de este agente: basta
                  que sea del mismo cliente. El de cobros no atiende entrante, no
                  tiene numero propio, y sin esto no podria marcar nunca. La
                  frontera la sigue poniendo el servidor. */}
              <LlamarForm
                assistantId={agente.id}
                numeros={agente.numeros.length > 0 ? agente.numeros : numeros}
              />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EditorScript({ agente }: { agente: AgenteRecord }) {
  const [script, setScript] = useState(agente.script);
  const [borrador, setBorrador] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => setScript(agente.script), [agente.script]);

  const editando = borrador !== null;
  const texto = editando ? borrador : script;

  async function guardar() {
    if (borrador === null) return;
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/agentes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assistantId: agente.id, script: borrador }),
      });
      const data = (await res.json()) as { ok?: boolean; script?: string; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Vapi respondió ${res.status}`);
        return;
      }
      setScript(data.script ?? borrador);
      setBorrador(null);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-[var(--text-3)]">
          {texto.length.toLocaleString("es-SV")} caracteres
        </p>
        <div className="flex items-center gap-1.5">
          {guardado && (
            <span className="flex items-center gap-1 text-[11.5px] font-medium text-emerald-600">
              <Check size={13} /> Guardado
            </span>
          )}
          {!editando && (
            <>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(script);
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 1800);
                  } catch {
                    /* sin permiso de portapapeles: el texto ya es seleccionable */
                  }
                }}
                className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--text-2)] transition hover:bg-surface"
              >
                <Copy size={12} />
                {copiado ? "Copiado" : "Copiar"}
              </button>
              <button
                type="button"
                onClick={() => setBorrador(script)}
                className="rounded-lg bg-brand px-3 py-1.5 text-[11.5px] font-semibold text-white transition hover:opacity-90"
              >
                Editar
              </button>
            </>
          )}
        </div>
      </div>

      {editando ? (
        <>
          <textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            spellCheck={false}
            aria-label={`Script de ${agente.nombre}`}
            className="h-[26rem] w-full resize-y rounded-xl border border-line bg-surface p-3 font-mono text-[11.5px] leading-relaxed text-[var(--text)] outline-none focus:border-brand"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={guardando || borrador.trim().length === 0}
              className="rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {guardando ? "Guardando..." : "Guardar en Vapi"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBorrador(null);
                setError(null);
              }}
              disabled={guardando}
              className="rounded-lg border border-line px-3.5 py-2 text-[12.5px] font-medium text-[var(--text-2)] transition hover:bg-surface disabled:opacity-40"
            >
              Cancelar
            </button>
            {borrador.trim().length === 0 && (
              <span className="text-[11.5px] text-[var(--text-3)]">No puede quedar vacío</span>
            )}
          </div>
        </>
      ) : script ? (
        <pre className="whitespace-pre-wrap rounded-xl bg-surface p-4 text-[11.5px] leading-relaxed text-[var(--text-2)]">
          {script}
        </pre>
      ) : (
        <p className="rounded-xl bg-surface p-4 text-[12.5px] text-[var(--text-3)]">
          Este agente no tiene instrucciones. Presioná Editar para escribirle un script.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11.5px] text-red-900">
          No se pudo guardar: {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function GestorNumeros({
  agente,
  numeros,
  onCambio,
}: {
  agente: AgenteRecord;
  numeros: NumeroRecord[];
  onCambio: () => void;
}) {
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mios = numeros.filter((n) => n.assistantId === agente.id);
  const otros = numeros.filter((n) => n.assistantId !== agente.id);

  async function cambiar(phoneNumberId: string, assistantId: string | null) {
    setTrabajando(phoneNumberId);
    setError(null);
    try {
      const res = await fetch("/api/numeros", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumberId, assistantId }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? `Vapi respondió ${res.status}`);
        return;
      }
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <div className="space-y-5">
      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
          Atiende estos números
        </p>
        {mios.length === 0 ? (
          <p className="rounded-xl bg-surface p-3.5 text-[12.5px] text-[var(--text-3)]">
            Sin números. Asignale uno de la lista de abajo para que pueda recibir y hacer llamadas.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {mios.map((n) => (
              <li
                key={n.id}
                className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 px-3.5 py-2.5"
              >
                <Phone size={15} className="shrink-0 text-[#2f9e2f]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[13px] font-bold text-[var(--text)]">
                    {n.numero}
                  </p>
                  {n.nombre && (
                    <p className="truncate text-[11.5px] text-[var(--text-3)]">{n.nombre}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void cambiar(n.id, null)}
                  disabled={trabajando === n.id}
                  className="flex items-center gap-1 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--text-2)] transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                >
                  <Trash2 size={12} />
                  {trabajando === n.id ? "..." : "Quitar"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
          Otros números disponibles
        </p>
        {otros.length === 0 ? (
          <p className="rounded-xl bg-surface p-3.5 text-[12.5px] text-[var(--text-3)]">
            No hay más números en la cuenta.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {otros.map((n) => {
              const ocupado = Boolean(n.assistantId);
              return (
                <li
                  key={n.id}
                  className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5"
                >
                  <Phone size={15} className="shrink-0 text-[var(--text-3)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[13px] font-semibold text-[var(--text)]">
                      {n.numero}
                    </p>
                    <p className="truncate text-[11.5px] text-[var(--text-3)]">
                      {ocupado ? `Lo atiende ${n.nombreAssistant || "otro agente"}` : "Libre"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void cambiar(n.id, agente.id)}
                    disabled={trabajando === n.id}
                    className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--text-2)] transition hover:border-brand hover:text-brand disabled:opacity-40"
                  >
                    {trabajando === n.id ? "..." : ocupado ? "Reasignar" : "Asignar"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {otros.some((n) => n.assistantId) && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--text-3)]">
            Reasignar le quita el número al agente que lo tiene ahora. Un número solo puede ser
            atendido por un agente a la vez.
          </p>
        )}
      </section>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11.5px] text-red-900">
          {error}
        </p>
      )}
    </div>
  );
}
