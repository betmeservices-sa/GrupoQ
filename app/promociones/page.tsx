"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BadgePercent,
  Check,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { promocionesVigentes, type Promocion, type PromocionNueva } from "@/lib/promos";

const VACIA: PromocionNueva = {
  nombre: "",
  descripcion: "",
  precio: "",
  restricciones: "",
  desde: "",
  hasta: "",
  activa: true,
};

const input =
  "w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-[var(--text)] outline-none transition focus:border-brand focus:bg-card";
const etiqueta = "mb-1 block text-[11.5px] font-semibold text-[var(--text-2)]";

export default function PromocionesPage() {
  const [promos, setPromos] = useState<Promocion[]>([]);
  const [enMemoria, setEnMemoria] = useState(false);
  const [sinTabla, setSinTabla] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | "nueva" | null>(null);

  const hoy = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch("/api/promos", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) {
        setPromos(d.promos);
        setEnMemoria(Boolean(d.enMemoria));
        setSinTabla(Boolean(d.sinTabla));
        setError(null);
      } else {
        setError(d.error ?? "No se pudieron leer las promociones.");
      }
    } catch {
      setError("No se pudieron leer las promociones.");
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(entrada: PromocionNueva, id?: string) {
    const r = await fetch("/api/promos", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(id ? { id, ...entrada } : entrada),
    });
    const d = await r.json();
    if (!d.ok) {
      setError(d.error ?? "No se pudo guardar.");
      return false;
    }
    setEditando(null);
    await cargar();
    return true;
  }

  async function alternar(p: Promocion) {
    // Cambio optimista: el interruptor tiene que sentirse instantáneo, y el
    // servidor confirma en la recarga de abajo.
    setPromos((prev) => prev.map((x) => (x.id === p.id ? { ...x, activa: !x.activa } : x)));
    await fetch("/api/promos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: p.id, activa: !p.activa }),
    });
    await cargar();
  }

  async function borrar(p: Promocion) {
    setPromos((prev) => prev.filter((x) => x.id !== p.id));
    await fetch(`/api/promos?id=${encodeURIComponent(p.id)}`, { method: "DELETE" });
    await cargar();
  }

  const vigentes = promocionesVigentes(promos, hoy);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Promociones</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            Lo que enciendas acá es lo único que el agente puede ofrecer por WhatsApp
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando("nueva")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-[13px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110"
        >
          <Plus size={15} />
          Nueva promoción
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-[var(--brand-red)]/40 bg-[var(--brand-red)]/10 px-3.5 py-2.5 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--brand-red)]" />
            {error}
          </p>
        )}

        {enMemoria && (
          <p className="flex items-start gap-2 rounded-xl border border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--text-2)]">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
            {sinTabla
              ? "Falta correr la migración de la tabla promos en la base (supabase/migrations). Mientras tanto se guardan en memoria: sirven para probar, pero se pierden al reiniciar y el agente en producción podría no verlas."
              : "Las promociones se están guardando en memoria porque falta configurar la base. Sirven para probar, pero se pierden al reiniciar y el agente en producción podría no verlas."}
          </p>
        )}

        {editando === "nueva" && (
          <Formulario
            titulo="Nueva promoción"
            inicial={VACIA}
            onCancelar={() => setEditando(null)}
            onGuardar={(v) => guardar(v)}
          />
        )}

        {cargando ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-card p-5 text-[13px] text-[var(--text-2)]">
            <Loader2 size={15} className="animate-spin text-brand" />
            Leyendo promociones
          </div>
        ) : promos.length === 0 && editando !== "nueva" ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-2)] bg-card p-8 text-center">
            <BadgePercent size={26} className="mx-auto text-[var(--text-3)]" />
            <p className="mt-3 text-[13.5px] font-bold text-[var(--text)]">
              Todavía no hay promociones
            </p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-[var(--text-3)]">
              Mientras esta lista esté vacía, el agente cotiza con la tarifa normal y no ofrece
              descuentos.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {promos.map((p) =>
              editando === p.id ? (
                <Formulario
                  key={p.id}
                  titulo="Editar promoción"
                  inicial={p}
                  onCancelar={() => setEditando(null)}
                  onGuardar={(v) => guardar(v, p.id)}
                />
              ) : (
                <Tarjeta
                  key={p.id}
                  promo={p}
                  vigente={vigentes.some((v) => v.id === p.id)}
                  onEditar={() => setEditando(p.id)}
                  onAlternar={() => alternar(p)}
                  onBorrar={() => borrar(p)}
                />
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tarjeta({
  promo,
  vigente,
  onEditar,
  onAlternar,
  onBorrar,
}: {
  promo: Promocion;
  vigente: boolean;
  onEditar: () => void;
  onAlternar: () => void;
  onBorrar: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-sm transition",
        vigente ? "border-brand/45" : "border-line opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[14.5px] font-bold text-[var(--text)]">{promo.nombre}</h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-[var(--text-2)]">
            {promo.descripcion}
          </p>
        </div>
        <Interruptor activa={promo.activa} onClick={onAlternar} />
      </div>

      <dl className="mt-3 space-y-1.5 text-[12.5px]">
        <Dato titulo="Precio" valor={promo.precio} />
        <Dato titulo="Restricciones" valor={promo.restricciones} />
        <Dato titulo="Vigencia" valor={vigenciaEnPalabras(promo)} />
      </dl>

      <div className="mt-4 flex items-center gap-2">
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11.5px] font-bold",
            vigente ? "bg-brand/12 text-brand" : "bg-[var(--surface-2)] text-[var(--text-3)]",
          )}
        >
          {vigente ? "El agente la está ofreciendo" : "El agente no la menciona"}
        </span>
        <button
          type="button"
          onClick={onEditar}
          className="ml-auto rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={onBorrar}
          aria-label={`Borrar ${promo.nombre}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] transition hover:bg-[var(--brand-red)]/10 hover:text-[var(--brand-red)]"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </article>
  );
}

function fecha(f: string): string {
  const [a, m, d] = f.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

function vigenciaEnPalabras(p: Promocion): string {
  if (p.desde && p.hasta) return `del ${fecha(p.desde)} al ${fecha(p.hasta)}`;
  if (p.hasta) return `hasta el ${fecha(p.hasta)}`;
  if (p.desde) return `desde el ${fecha(p.desde)}`;
  return "sin fecha de corte";
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  if (!valor.trim()) return null;
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 font-semibold text-[var(--text-3)]">{titulo}</dt>
      <dd className="flex-1 text-[var(--text-2)]">{valor}</dd>
    </div>
  );
}

function Interruptor({ activa, onClick }: { activa: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activa}
      onClick={onClick}
      title={activa ? "Apagar promoción" : "Encender promoción"}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition",
        activa ? "bg-brand" : "bg-[var(--border-2)]",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition",
          activa ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function Formulario({
  titulo,
  inicial,
  onCancelar,
  onGuardar,
}: {
  titulo: string;
  inicial: PromocionNueva;
  onCancelar: () => void;
  onGuardar: (v: PromocionNueva) => Promise<boolean>;
}) {
  const [v, setV] = useState<PromocionNueva>({
    nombre: inicial.nombre,
    descripcion: inicial.descripcion,
    precio: inicial.precio,
    restricciones: inicial.restricciones,
    desde: inicial.desde ?? "",
    hasta: inicial.hasta ?? "",
    activa: inicial.activa,
  });
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setEnviando(true);
    await onGuardar(v);
    setEnviando(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
      className="rounded-2xl border border-brand/45 bg-card p-5 shadow-sm xl:col-span-2"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[var(--text)]">{titulo}</h2>
        <button
          type="button"
          onClick={onCancelar}
          aria-label="Cerrar"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-3)] transition hover:bg-surface"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="sm:col-span-2">
          <span className={etiqueta}>Nombre</span>
          <input
            value={v.nombre}
            onChange={(e) => setV({ ...v, nombre: e.target.value })}
            placeholder="Escapada de fin de semana"
            className={input}
            required
          />
        </label>
        <label className="sm:col-span-2">
          <span className={etiqueta}>Qué incluye</span>
          <textarea
            value={v.descripcion}
            onChange={(e) => setV({ ...v, descripcion: e.target.value })}
            placeholder="Dos noches en Bungalow con desayuno para dos personas."
            rows={2}
            className={cn(input, "resize-y")}
          />
        </label>
        <label>
          <span className={etiqueta}>Precio</span>
          <input
            value={v.precio}
            onChange={(e) => setV({ ...v, precio: e.target.value })}
            placeholder="$260 las dos noches"
            className={input}
          />
        </label>
        <label>
          <span className={etiqueta}>Restricciones</span>
          <input
            value={v.restricciones}
            onChange={(e) => setV({ ...v, restricciones: e.target.value })}
            placeholder="No aplica en feriados ni Semana Santa"
            className={input}
          />
        </label>
        <label>
          <span className={etiqueta}>Desde</span>
          <input
            type="date"
            value={v.desde ?? ""}
            onChange={(e) => setV({ ...v, desde: e.target.value })}
            className={input}
          />
        </label>
        <label>
          <span className={etiqueta}>Hasta</span>
          <input
            type="date"
            value={v.hasta ?? ""}
            onChange={(e) => setV({ ...v, hasta: e.target.value })}
            className={input}
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--text-2)]">
          <Interruptor activa={v.activa} onClick={() => setV({ ...v, activa: !v.activa })} />
          {v.activa ? "Encendida" : "Apagada"}
        </label>
        <button
          type="submit"
          disabled={enviando || !v.nombre.trim()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-[13px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110 disabled:opacity-60"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Guardar
        </button>
      </div>
    </form>
  );
}
