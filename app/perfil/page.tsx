"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  ClipboardCheck,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Target,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface CampoPerfil {
  id: string;
  titulo: string;
  ayuda: string;
  texto: string;
  icono: string;
}

interface Solicitud {
  numero: string;
  campo: string;
  texto: string;
  estado: string;
  creada: string;
}

const ICONOS: Record<string, LucideIcon> = {
  Sparkles,
  Target,
  MessageSquare,
  ShieldCheck,
};

export default function PerfilPage() {
  const [campos, setCampos] = useState<CampoPerfil[]>([]);
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  // Confirmación de la última edición: qué campo y con qué número de gestión.
  const [confirmado, setConfirmado] = useState<{ campo: string; numero: string } | null>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/perfil", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) {
        setCampos(d.campos);
        setSolicitudes(d.solicitudes ?? []);
        setError(null);
      } else {
        setError(d.error ?? "No se pudo leer el perfil.");
      }
    } catch {
      setError("No se pudo leer el perfil.");
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function enviar(campo: string, texto: string): Promise<boolean> {
    const r = await fetch("/api/perfil", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campo, texto }),
    });
    const d = await r.json();
    if (!d.ok) {
      setError(d.error ?? "No se pudo registrar el cambio.");
      return false;
    }
    setConfirmado({ campo, numero: d.solicitud.numero });
    setEditando(null);
    await cargar();
    return true;
  }

  // La última solicitud de cada campo, para mostrar qué quedó pendiente.
  const pendientePorCampo = new Map<string, Solicitud>();
  for (const s of solicitudes) if (!pendientePorCampo.has(s.campo)) pendientePorCampo.set(s.campo, s);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-5 py-3">
        <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Perfil del agente</h1>
        <p className="text-[12.5px] text-[var(--text-3)]">
          Cómo se comporta Sofía cuando le escriben por WhatsApp
        </p>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="flex items-start gap-3 rounded-2xl border border-line bg-card p-5 shadow-sm">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <Bot size={22} />
          </span>
          <div>
            <p className="text-[14.5px] font-bold text-[var(--text)]">Sofía, recepción virtual</p>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-2)]">
              Contesta WhatsApp de los tres hoteles, identifica a cuál escriben, consulta
              disponibilidad y tarifas, y deja la reserva tomada. Abajo están las cuatro cosas que
              definen su forma de trabajar.
            </p>
          </div>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-[var(--brand-red)]/40 bg-[var(--brand-red)]/10 px-3.5 py-2.5 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--brand-red)]" />
            {error}
          </p>
        )}

        {confirmado && (
          <div className="flex items-start gap-2.5 rounded-xl border border-brand/45 bg-brand/[0.07] px-4 py-3">
            <ClipboardCheck size={17} className="mt-0.5 shrink-0 text-brand" />
            <div className="flex-1">
              <p className="text-[13px] font-bold text-[var(--text)]">Cambio recibido</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-2)]">
                Su número de gestión es{" "}
                <strong className="font-bold text-brand">{confirmado.numero}</strong>. El equipo lo
                aplica al agente y le confirma por ese número.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setConfirmado(null)}
              aria-label="Cerrar aviso"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-3)] transition hover:bg-surface"
            >
              <X size={15} />
            </button>
          </div>
        )}

        {cargando ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-card p-5 text-[13px] text-[var(--text-2)]">
            <Loader2 size={15} className="animate-spin text-brand" />
            Leyendo el perfil
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {campos.map((campo) => (
              <Tarjeta
                key={campo.id}
                campo={campo}
                pendiente={pendientePorCampo.get(campo.id) ?? null}
                editando={editando === campo.id}
                onEditar={() => setEditando(campo.id)}
                onCancelar={() => setEditando(null)}
                onGuardar={(texto) => enviar(campo.id, texto)}
              />
            ))}
          </div>
        )}

        <p className="rounded-xl bg-surface/70 px-4 py-3 text-[12px] leading-relaxed text-[var(--text-2)]">
          En cada tarjeta puede pedir un cambio contando con sus palabras qué quiere distinto.
          Queda registrado con su número de gestión y el equipo lo pasa al agente. No se aplica
          solo a propósito: así ningún ajuste rompe las reglas de seguridad ni el manejo de
          reservas que ya están probados.
        </p>
      </div>
    </div>
  );
}

function Tarjeta({
  campo,
  pendiente,
  editando,
  onEditar,
  onCancelar,
  onGuardar,
}: {
  campo: CampoPerfil;
  pendiente: Solicitud | null;
  editando: boolean;
  onEditar: () => void;
  onCancelar: () => void;
  onGuardar: (texto: string) => Promise<boolean>;
}) {
  const Icon = ICONOS[campo.icono] ?? Sparkles;
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    setEnviando(true);
    await onGuardar(texto.trim());
    setEnviando(false);
  }

  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm",
        editando ? "border-brand/45" : "border-line",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-bold text-[var(--text)]">{campo.titulo}</h2>
          <p className="text-[11.5px] text-[var(--text-3)]">{campo.ayuda}</p>
        </div>
        {!editando && (
          <button
            type="button"
            onClick={() => {
              setTexto("");
              onEditar();
            }}
            className="shrink-0 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface"
          >
            Pedir un cambio
          </button>
        )}
      </div>

      {editando ? (
        <div className="mt-3">
          <p className="mb-2 rounded-xl bg-surface/70 px-3 py-2.5 text-[12.5px] leading-relaxed text-[var(--text-2)]">
            {campo.texto}
          </p>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            autoFocus
            placeholder="Explique qué quiere cambiar. Por ejemplo: que salude en inglés cuando le escriban en inglés, o que no ofrezca la Planta Baja."
            className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-[var(--text)] outline-none transition focus:border-brand focus:bg-card"
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={onCancelar}
              className="rounded-lg border border-line bg-card px-3 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void guardar()}
              disabled={enviando || !texto.trim()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-[13px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110 disabled:opacity-60"
            >
              {enviando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Enviar solicitud
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-2)]">{campo.texto}</p>
          {pendiente && (
            <div className="mt-3 rounded-xl border border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/10 p-3">
              <p className="text-[11.5px] font-bold text-[var(--brand-accent)]">
                Cambio pedido · {pendiente.numero}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-2)]">
                {pendiente.texto}
              </p>
            </div>
          )}
        </>
      )}
    </article>
  );
}
