"use client";

// El tablero de tickets.
//
// Sale de la reunión del 20 de agosto con el hospital. El reclamo de fondo, que
// Helen y Roberto plantearon por caminos distintos, era el mismo: cuando Sofía
// transfiere, hoy se pierde el rastro. Nadie sabe si atendieron, cuánto
// tardaron, ni si el caso quedó cerrado.
//
// Por eso la pantalla abre con los dos relojes arriba y la cola abajo, y no al
// revés: lo primero que hay que ver es si algo lleva mucho tiempo sin que nadie
// lo agarre.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  Plus,
  Timer,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { staff } from "@/lib/data/seed";
import {
  ESTADOS,
  ORIGENES,
  PRIORIDADES,
  TIPOS,
  etiquetaEstado,
  etiquetaOrigen,
  etiquetaTipo,
  type EstadoTicket,
  type Ticket,
  type TipoTicket,
} from "@/lib/tickets";
import type { MetricasTickets } from "@/lib/tickets-metricas";
import { formatearMinutos } from "@/lib/tickets-sla";

interface Respuesta {
  ok: boolean;
  tickets?: Ticket[];
  metricas?: MetricasTickets;
  enMemoria?: boolean;
  sinTabla?: boolean;
  error?: string;
}

const AREAS = [
  { id: "atencion", label: "Atención al cliente" },
  { id: "ventas", label: "Ventas" },
  { id: "recepcion", label: "Recepción" },
  { id: "laboratorio", label: "Laboratorio" },
  { id: "imagenes", label: "Imágenes" },
  { id: "caja", label: "Caja y facturación" },
  { id: "ginecologia", label: "Ginecología" },
];

const areaLabel = (id: string) => AREAS.find((a) => a.id === id)?.label ?? id;
const nombreStaff = (id?: string) => (id ? (staff.find((s) => s.id === id)?.nombre ?? id) : null);

const COLOR_ESTADO: Record<EstadoTicket, string> = {
  abierto: "bg-[var(--warn-bg,#fef3c7)] text-[var(--warn-fg,#92400e)]",
  asignado: "bg-[var(--info-bg,#dbeafe)] text-[var(--info-fg,#1e40af)]",
  en_proceso: "bg-[var(--info-bg,#dbeafe)] text-[var(--info-fg,#1e40af)]",
  resuelto: "bg-[var(--ok-bg,#dcfce7)] text-[var(--ok-fg,#166534)]",
};

function horaCorta(iso: string) {
  return new Date(iso).toLocaleString("es-SV", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TicketsPage() {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<EstadoTicket | "pendientes" | "todos">("pendientes");
  const [filtroArea, setFiltroArea] = useState<string>("todas");
  const [abierto, setAbierto] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await fetch("/api/tickets", { cache: "no-store" });
    setDatos((await r.json()) as Respuesta);
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const tickets = useMemo(() => datos?.tickets ?? [], [datos]);
  const m = datos?.metricas;

  const visibles = useMemo(
    () =>
      tickets.filter((t) => {
        if (filtroArea !== "todas" && t.area !== filtroArea) return false;
        if (filtroEstado === "todos") return true;
        if (filtroEstado === "pendientes") return t.estado !== "resuelto";
        return t.estado === filtroEstado;
      }),
    [tickets, filtroEstado, filtroArea],
  );

  async function actualizar(id: string, cambios: Record<string, unknown>) {
    await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...cambios }),
    });
    await cargar();
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-card px-5 py-3">
        <div className="mr-auto">
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Tickets</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            Lo que Sofía no resolvió sola, con dueño y con reloj
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreando(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-white"
        >
          <Plus size={15} />
          Nuevo ticket
        </button>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {datos?.sinTabla && (
          <p className="rounded-xl border border-[var(--warn-line,#fcd34d)] bg-[var(--warn-bg,#fffbeb)] px-4 py-3 text-[12.5px] text-[var(--warn-fg,#92400e)]">
            Los tickets se están guardando en memoria: falta correr la migración
            <code className="mx-1">20260821000000_tickets.sql</code>. Se enganchan solos a los
            pocos minutos de correrla, sin redesplegar.
          </p>
        )}

        {/* Los dos relojes, separados a propósito: uno mide la cola y el otro a
            quien atiende. Juntos esconderían cuál de los dos está fallando. */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Tarjeta
            icono={<Inbox size={16} />}
            label="Sin tomar"
            valor={m ? String(m.sinTomar) : "—"}
            ayuda="Nadie se hizo cargo todavía"
            alerta={!!m && m.sinTomar > 0}
          />
          <Tarjeta
            icono={<Timer size={16} />}
            label="Tiempo de atención"
            valor={m?.promedioAtencion !== null && m ? formatearMinutos(m.promedioAtencion) : "—"}
            ayuda="Desde que entra hasta que alguien lo toma"
          />
          <Tarjeta
            icono={<Clock size={16} />}
            label="Tiempo de resolución"
            valor={m?.promedioResolucion !== null && m ? formatearMinutos(m.promedioResolucion) : "—"}
            ayuda="Desde que lo toman hasta que se cierra"
          />
          <Tarjeta
            icono={<CheckCircle2 size={16} />}
            label="Resueltos"
            valor={m ? `${m.resueltos} de ${m.total}` : "—"}
            ayuda="En todo lo que lleva el tablero"
          />
        </section>

        <p className="text-[12px] leading-relaxed text-[var(--text-3)]">
          Los tiempos cuentan solo horas hábiles (lunes a viernes de 7 a 19, sábados de 8 a 13). Un
          ticket que entra a las 2 de la mañana y se resuelve a las 8:15 tardó 15 minutos, no seis
          horas.
        </p>

        {m?.masEsperado && (
          <div className="flex items-start gap-2.5 rounded-xl border border-[var(--warn-line,#fcd34d)] bg-[var(--warn-bg,#fffbeb)] px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warn-fg,#92400e)]" />
            <p className="text-[12.5px] leading-relaxed text-[var(--warn-fg,#92400e)]">
              <strong>#{m.masEsperado.ticket.numero} lleva {formatearMinutos(m.masEsperado.minutos)} sin que nadie lo tome.</strong>{" "}
              {m.masEsperado.ticket.titulo}, de {m.masEsperado.ticket.contactoNombre}.
            </p>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <Filtro activo={filtroEstado === "pendientes"} onClick={() => setFiltroEstado("pendientes")}>
            Pendientes
          </Filtro>
          {ESTADOS.map((e) => (
            <Filtro key={e.id} activo={filtroEstado === e.id} onClick={() => setFiltroEstado(e.id)} title={e.ayuda}>
              {e.label}
              {m ? ` · ${m.porEstado[e.id]}` : ""}
            </Filtro>
          ))}
          <Filtro activo={filtroEstado === "todos"} onClick={() => setFiltroEstado("todos")}>
            Todos
          </Filtro>
          <select
            value={filtroArea}
            onChange={(e) => setFiltroArea(e.target.value)}
            className="ml-auto rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12.5px]"
          >
            <option value="todas">Todas las áreas</option>
            {AREAS.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </div>

        {/* La cola */}
        {cargando ? (
          <p className="flex items-center gap-2 py-8 text-[13px] text-[var(--text-3)]">
            <Loader2 size={15} className="animate-spin" />
            Cargando tickets
          </p>
        ) : visibles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-2)] bg-card p-8 text-center">
            <Inbox size={26} className="mx-auto text-[var(--text-3)]" />
            <p className="mt-2 text-[13px] text-[var(--text-2)]">Nada por acá con esos filtros.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {visibles.map((t) => (
              <li key={t.id}>
                <Fila
                  t={t}
                  abierto={abierto === t.id}
                  onToggle={() => setAbierto(abierto === t.id ? null : t.id)}
                  onCambio={(c) => actualizar(t.id, c)}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Por persona: lo que Helen pidió para ver la efectividad de cada uno */}
        {m && m.porPersona.length > 0 && (
          <section className="rounded-2xl border border-line bg-card p-4">
            <h2 className="text-[14px] font-bold text-brand">Por persona</h2>
            <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
              El promedio cuenta solo los que cada uno cerró.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-line text-left text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                    <th className="py-2 font-semibold">Quién</th>
                    <th className="py-2 text-right font-semibold">Asignados</th>
                    <th className="py-2 text-right font-semibold">Resueltos</th>
                    <th className="py-2 text-right font-semibold">Pendientes</th>
                    <th className="py-2 text-right font-semibold">Promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {m.porPersona.map((p) => (
                    <tr key={p.staffId} className="border-b border-line last:border-0">
                      <td className="py-2">{nombreStaff(p.staffId)}</td>
                      <td className="py-2 text-right tabular-nums">{p.asignados}</td>
                      <td className="py-2 text-right tabular-nums">{p.resueltos}</td>
                      <td className="py-2 text-right tabular-nums">{p.abiertos}</td>
                      <td className="py-2 text-right tabular-nums">
                        {p.promedioResolucion === null ? (
                          <span className="text-[var(--text-3)]">sin cerrar aún</span>
                        ) : (
                          formatearMinutos(p.promedioResolucion)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Por tipo: la tipificación que pidió Roberto para saber de qué llaman */}
        {m && m.porTipo.length > 0 && (
          <section className="rounded-2xl border border-line bg-card p-4">
            <h2 className="text-[14px] font-bold text-brand">De qué se trata</h2>
            <ul className="mt-3 space-y-1.5">
              {m.porTipo.map((f) => (
                <li key={f.tipo} className="flex items-center gap-3 text-[12.5px]">
                  <span className="w-32 shrink-0">{etiquetaTipo(f.tipo)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--bg-2,#f1f5f9)]">
                    <span
                      className="block h-full rounded-full bg-brand"
                      style={{ width: `${Math.round((f.total / m.total) * 100)}%` }}
                    />
                  </span>
                  <span className="w-24 shrink-0 text-right tabular-nums text-[var(--text-3)]">
                    {f.total} · {f.abiertos} abiertos
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {creando && (
        <FormularioNuevo
          onCerrar={() => setCreando(false)}
          onCreado={async () => {
            setCreando(false);
            await cargar();
          }}
        />
      )}
    </div>
  );
}

function Tarjeta({
  icono,
  label,
  valor,
  ayuda,
  alerta,
}: {
  icono: React.ReactNode;
  label: string;
  valor: string;
  ayuda: string;
  alerta?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4",
        alerta ? "border-[var(--warn-line,#fcd34d)]" : "border-line",
      )}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
        {icono}
        {label}
      </p>
      <p className="mt-1.5 text-[24px] font-bold tabular-nums text-brand">{valor}</p>
      <p className="mt-0.5 text-[11.5px] leading-snug text-[var(--text-3)]">{ayuda}</p>
    </div>
  );
}

function Filtro({
  activo,
  onClick,
  children,
  title,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12.5px] transition",
        activo
          ? "border-brand bg-brand text-white"
          : "border-line bg-card text-[var(--text-2)] hover:border-[var(--border-2)]",
      )}
    >
      {children}
    </button>
  );
}

function Fila({
  t,
  abierto,
  onToggle,
  onCambio,
}: {
  t: Ticket;
  abierto: boolean;
  onToggle: () => void;
  onCambio: (cambios: Record<string, unknown>) => void;
}) {
  const [nota, setNota] = useState("");

  return (
    <div className="rounded-xl border border-line bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-4 py-3 text-left"
      >
        <span className="mt-0.5 w-10 shrink-0 text-[12px] font-bold tabular-nums text-[var(--text-3)]">
          #{t.numero}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-[13.5px] font-semibold text-[var(--text-1)]">{t.titulo}</span>
            {t.prioridad === "urgente" && (
              <span className="rounded-full bg-[var(--bad-bg,#fee2e2)] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[var(--bad-fg,#991b1b)]">
                Urgente
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[12px] text-[var(--text-3)]">
            {t.contactoNombre} · {areaLabel(t.area)} · {etiquetaOrigen(t.origen)} · {horaCorta(t.creado)}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {t.asignadoA ? (
            <span className="hidden items-center gap-1 text-[11.5px] text-[var(--text-3)] sm:flex">
              <UserRound size={12} />
              {nombreStaff(t.asignadoA)}
            </span>
          ) : null}
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", COLOR_ESTADO[t.estado])}>
            {etiquetaEstado(t.estado)}
          </span>
        </span>
      </button>

      {abierto && (
        <div className="space-y-3 border-t border-line px-4 py-3">
          {t.detalle && <p className="text-[12.5px] leading-relaxed text-[var(--text-2)]">{t.detalle}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={t.asignadoA ?? ""}
              onChange={(e) => onCambio({ asignadoA: e.target.value })}
              className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12.5px]"
            >
              <option value="">Sin asignar</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            <select
              value={t.estado}
              onChange={(e) => onCambio({ estado: e.target.value })}
              className="rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12.5px]"
            >
              {ESTADOS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </select>
            <span className="text-[11.5px] text-[var(--text-3)]">
              {t.contactoTelefono} · {etiquetaTipo(t.tipo)} · abrió {t.creadoPor}
            </span>
          </div>

          {t.notas.length > 0 && (
            <ul className="space-y-1.5">
              {t.notas.map((n) => (
                <li key={n.id} className="rounded-lg bg-[var(--bg-2,#f8fafc)] px-3 py-2 text-[12px]">
                  <span className="font-semibold text-[var(--text-2)]">{n.autor}</span>{" "}
                  <span className="text-[var(--text-3)]">{horaCorta(n.ts)}</span>
                  <p className="mt-0.5 text-[var(--text-2)]">{n.texto}</p>
                </li>
              ))}
            </ul>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!nota.trim()) return;
              onCambio({ nota, autor: "Gerente de Marketing" });
              setNota("");
            }}
            className="flex gap-2"
          >
            <input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Qué pasó con este caso"
              className="flex-1 rounded-lg border border-line bg-card px-3 py-1.5 text-[12.5px]"
            />
            <button
              type="submit"
              className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-semibold text-[var(--text-2)]"
            >
              Anotar
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function FormularioNuevo({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const [form, setForm] = useState({
    titulo: "",
    detalle: "",
    contactoNombre: "",
    contactoTelefono: "",
    tipo: "cotizacion" as TipoTicket,
    area: "ventas",
    prioridad: "normal",
    origen: "manual",
    asignadoA: "",
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const r = await fetch("/api/tickets", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, creadoPor: "Mostrador" }),
    });
    const j = await r.json();
    setGuardando(false);
    if (!j.ok) {
      setError(j.error ?? "No se pudo crear.");
      return;
    }
    onCreado();
  }

  const campo = "w-full rounded-lg border border-line bg-card px-3 py-2 text-[13px]";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <form
        onSubmit={enviar}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card p-5 sm:rounded-2xl"
      >
        <h2 className="text-[16px] font-bold text-brand">Nuevo ticket</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--text-3)]">
          Para quien llegó al mostrador o llamó por otro lado. Queda con el mismo reloj que los que
          abre Sofía.
        </p>

        <div className="mt-4 space-y-3">
          <input
            required
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            placeholder="Qué necesita"
            className={campo}
          />
          <textarea
            value={form.detalle}
            onChange={(e) => setForm({ ...form, detalle: e.target.value })}
            placeholder="Detalle (opcional)"
            rows={3}
            className={campo}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              required
              value={form.contactoNombre}
              onChange={(e) => setForm({ ...form, contactoNombre: e.target.value })}
              placeholder="Nombre"
              className={campo}
            />
            <input
              value={form.contactoTelefono}
              onChange={(e) => setForm({ ...form, contactoTelefono: e.target.value })}
              placeholder="Teléfono"
              className={campo}
            />
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as TipoTicket })}
              className={campo}
            >
              {TIPOS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={form.area}
              onChange={(e) => setForm({ ...form, area: e.target.value })}
              className={campo}
            >
              {AREAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <select
              value={form.prioridad}
              onChange={(e) => setForm({ ...form, prioridad: e.target.value })}
              className={campo}
            >
              {PRIORIDADES.map((p) => (
                <option key={p.id} value={p.id}>
                  Prioridad {p.label.toLowerCase()}
                </option>
              ))}
            </select>
            <select
              value={form.origen}
              onChange={(e) => setForm({ ...form, origen: e.target.value })}
              className={campo}
            >
              {ORIGENES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <select
            value={form.asignadoA}
            onChange={(e) => setForm({ ...form, asignadoA: e.target.value })}
            className={campo}
          >
            <option value="">Dejarlo en la cola, sin asignar</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                Asignar a {s.nombre}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="mt-3 text-[12.5px] text-[var(--bad-fg,#991b1b)]">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-[var(--text-2)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {guardando && <Loader2 size={14} className="animate-spin" />}
            Crear ticket
          </button>
        </div>
      </form>
    </div>
  );
}
