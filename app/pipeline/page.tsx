"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarClock,
  Facebook,
  Instagram,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";
import { dineroCorto, dineroCortoMes, dinero, dineroMes, desdeHace, fechaCorta } from "@/lib/inmobiliaria-formato";
import { horaHablada } from "@/lib/inmobiliaria-visitas";
import {
  CARRILES,
  CARRIL_DETALLE,
  CARRIL_NOMBRE,
  ETAPAS,
  MUDANZA_NOMBRE,
  nombreEtapa,
  type CanalLead,
  type Carril,
  type Etapa,
  type Lead,
  type Pipeline,
  type Propiedad,
  type TableroOperacion,
  type TipoOperacion,
  type Urgencia,
} from "@/lib/inmobiliaria-tipos";

// Agendar se dispara desde la tarjeta del lead, que está tres niveles abajo:
// pasarlo por props sería ensuciar cuatro componentes con algo que solo usa uno.
const AbrirAgenda = createContext<(l: Lead) => void>(() => {});

const CANAL: Record<CanalLead, { Icon: LucideIcon; label: string }> = {
  whatsapp: { Icon: MessageCircle, label: "WhatsApp" },
  messenger: { Icon: Facebook, label: "Messenger" },
  instagram: { Icon: Instagram, label: "Instagram" },
  comentario: { Icon: MessageSquare, label: "Comentario" },
};

const CARRIL_COLOR: Record<Carril, string> = {
  contado: "var(--brand-green)",
  fsv: "var(--brand-blue)",
  banco: "var(--brand-accent)",
  ingreso: "var(--brand-green)",
  fiador: "var(--brand-blue)",
  deposito: "var(--brand-accent)",
  sin_definir: "var(--text-3)",
};

const URGENCIA: Record<Urgencia, { texto: string; punto: string }> = {
  al_dia: { texto: "text-[var(--text-3)]", punto: "bg-[var(--text-3)]/45" },
  enfriando: { texto: "text-[var(--brand-accent)]", punto: "bg-[var(--brand-accent)]" },
  abandonado: { texto: "text-[var(--brand-red)] font-bold", punto: "bg-[var(--brand-red)]" },
};

// La columna que se explica sola no lleva nota; la de "no calificado" sí, porque
// todo el mundo la confunde con la basura.
const NOTA_ETAPA: Partial<Record<Etapa, string>> = {
  no_calificado: "No puede todavía. Vuelven en meses.",
};

type Vista = "todas" | TipoOperacion;

// El dinero de un alquiler es mensual y el de una venta es total: cada uno se
// escribe con su unidad y NUNCA se suman entre sí.
function plata(monto: number, operacion: TipoOperacion, corto = false): string {
  if (operacion === "alquiler") return corto ? dineroCortoMes(monto) : dineroMes(monto);
  return corto ? dineroCorto(monto) : dinero(monto);
}

export default function PipelinePage() {
  const router = useRouter();
  const esInmobiliaria = activeTenantId() === "inmobiliaria";
  useEffect(() => {
    if (!esInmobiliaria) router.replace("/");
  }, [esInmobiliaria, router]);

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<Vista>("todas");
  const [agrupar, setAgrupar] = useState<"etapas" | "carril">("etapas");
  const [carril, setCarril] = useState<Carril | "todos">("todos");
  const [soloFrios, setSoloFrios] = useState(false);
  const [agendando, setAgendando] = useState<Lead | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/inmobiliaria/pipeline", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) {
        setPipeline(d.pipeline);
        setError(null);
      } else {
        setError(d.error ?? "No se pudo leer el pipeline.");
      }
    } catch {
      setError("No se pudo leer el pipeline.");
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (esInmobiliaria) cargar();
  }, [cargar, esInmobiliaria]);

  const tableros = useMemo<TableroOperacion[]>(() => {
    if (!pipeline) return [];
    if (vista === "venta") return [pipeline.venta];
    if (vista === "alquiler") return [pipeline.alquiler];
    return [pipeline.venta, pipeline.alquiler];
  }, [pipeline, vista]);

  const filtrar = useCallback(
    (leads: Lead[]) =>
      leads.filter(
        (l) =>
          (carril === "todos" || l.carril === carril) &&
          (!soloFrios || (l.etapa !== "cerrado" && l.urgencia !== "al_dia")),
      ),
    [carril, soloFrios],
  );

  if (!esInmobiliaria) return <div className="flex-1 bg-surface" />;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Pipeline</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            {pipeline
              ? `${vivos(pipeline.venta)} en venta por ${dinero(pipeline.venta.enJuego)} · ${vivos(pipeline.alquiler)} en alquiler por ${dineroMes(pipeline.alquiler.enJuego)}`
              : "Cargando los leads"}
          </p>
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-60"
        >
          <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
          Actualizar
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-5">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/10 px-4 py-3 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {cargando && !pipeline && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-line bg-card" />
            ))}
          </div>
        )}

        {pipeline && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-line bg-card p-0.5">
                {([
                  { id: "todas", label: "Las dos" },
                  { id: "venta", label: "Venta" },
                  { id: "alquiler", label: "Alquiler" },
                ] as const).map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setVista(v.id);
                      setCarril("todos");
                    }}
                    className={cn(
                      "rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold transition",
                      vista === v.id
                        ? "bg-brand text-white shadow-sm shadow-brand/25"
                        : "text-[var(--text-2)] hover:bg-surface",
                    )}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              <div className="inline-flex rounded-xl border border-line bg-card p-0.5">
                {(["etapas", "carril"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setAgrupar(v)}
                    className={cn(
                      "rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold transition",
                      agrupar === v
                        ? "bg-brand text-white shadow-sm shadow-brand/25"
                        : "text-[var(--text-2)] hover:bg-surface",
                    )}
                  >
                    {v === "etapas" ? "Por etapa" : "Por lo que lo califica"}
                  </button>
                ))}
              </div>

              {pipeline.sinTocar > 0 && (
                <button
                  type="button"
                  onClick={() => setSoloFrios(!soloFrios)}
                  aria-pressed={soloFrios}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition",
                    soloFrios
                      ? "border-[var(--brand-red)] bg-[var(--brand-red)]/10 text-[var(--brand-red)]"
                      : "border-line bg-card text-[var(--text-2)] hover:border-[var(--border-2)]",
                  )}
                >
                  <span className="h-2 w-2 rounded-full bg-[var(--brand-red)]" />
                  {pipeline.sinTocar} se están enfriando
                </button>
              )}
            </div>

            <AbrirAgenda.Provider value={setAgendando}>
              <div className="space-y-7">
                {tableros.map((t) => (
                  <TableroDeOperacion
                    key={t.operacion}
                    tablero={t}
                    leads={filtrar(t.leads)}
                    agrupar={agrupar}
                    carril={carril}
                    onCarril={(c) => setCarril(carril === c ? "todos" : c)}
                    conTitulo={vista === "todas"}
                  />
                ))}
              </div>
            </AbrirAgenda.Provider>
          </>
        )}
      </div>

      {agendando && (
        <DialogoVisita
          lead={agendando}
          onCerrar={() => setAgendando(null)}
          onListo={() => {
            setAgendando(null);
            cargar();
          }}
        />
      )}
    </div>
  );
}

function vivos(t: TableroOperacion): number {
  return t.leads.filter((l) => l.etapa !== "cerrado").length;
}

function TableroDeOperacion({
  tablero,
  leads,
  agrupar,
  carril,
  onCarril,
  conTitulo,
}: {
  tablero: TableroOperacion;
  leads: Lead[];
  agrupar: "etapas" | "carril";
  carril: Carril | "todos";
  onCarril: (c: Carril) => void;
  conTitulo: boolean;
}) {
  const op = tablero.operacion;
  return (
    <section>
      {conTitulo && (
        <div className="mb-2.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-[15px] font-extrabold tracking-tight text-[var(--text)]">
            {op === "venta" ? "Venta" : "Alquiler"}
          </h2>
          <p className="text-[12.5px] text-[var(--text-3)]">
            {vivos(tablero)} en juego por {plata(tablero.enJuego, op)}
            {op === "alquiler" ? " de renta" : ""}
          </p>
        </div>
      )}

      {/* Lo que califica al lead: en venta la forma de pago, en alquiler el
          respaldo de la renta. Cada tarjeta filtra el tablero. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tablero.porCarril.map((c) => (
          <TarjetaCarril
            key={c.carril}
            activa={carril === c.carril}
            onClick={() => onCarril(c.carril)}
            titulo={CARRIL_NOMBRE[c.carril]}
            detalle={CARRIL_DETALLE[c.carril]}
            leads={c.leads}
            monto={plata(c.monto, op, true)}
            color={CARRIL_COLOR[c.carril]}
          />
        ))}
      </div>

      <div className="mt-3">
        {agrupar === "etapas" ? (
          <TableroEtapas leads={leads} operacion={op} />
        ) : (
          <TableroCarril leads={leads} operacion={op} />
        )}
      </div>
    </section>
  );
}

function TarjetaCarril({
  activa,
  onClick,
  titulo,
  detalle,
  leads,
  monto,
  color,
}: {
  activa: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
  leads: number;
  monto: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={cn(
        "rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:shadow",
        activa ? "border-brand ring-1 ring-brand/30" : "border-line",
      )}
    >
      <span className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-[13px] font-bold text-[var(--text)]">{titulo}</span>
      </span>
      <p className="mt-2 text-[24px] font-extrabold leading-none tracking-tight text-[var(--text)]">
        {leads}
        <span className="ml-2 align-middle text-[13px] font-bold text-brand">{monto}</span>
      </p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--text-3)]">{detalle}</p>
    </button>
  );
}

function ordenar(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => b.dias - a.dias || b.presupuesto - a.presupuesto);
}

function TableroEtapas({ leads, operacion }: { leads: Lead[]; operacion: TipoOperacion }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {ETAPAS.map((etapa) => {
        const propios = ordenar(leads.filter((l) => l.etapa === etapa));
        const monto = propios.reduce((s, l) => s + l.presupuesto, 0);
        return (
          <div key={etapa} className="w-[268px] shrink-0 rounded-2xl border border-line bg-card/60">
            <div className="border-b border-line px-3.5 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-bold text-[var(--text)]">
                  {nombreEtapa(etapa, operacion)}
                </p>
                <p className="text-[12px] font-semibold text-[var(--text-3)]">
                  {propios.length} · {plata(monto, operacion, true)}
                </p>
              </div>
              {NOTA_ETAPA[etapa] && (
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-3)]">
                  {NOTA_ETAPA[etapa]}
                </p>
              )}
            </div>
            <div className="space-y-2 p-2.5">
              {propios.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--border-2)] px-3 py-4 text-center text-[12px] text-[var(--text-3)]">
                  Nadie aquí
                </p>
              ) : (
                propios.map((l) => <TarjetaLead key={l.id} lead={l} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Carril en filas, etapas en columnas: las dos dimensiones a la vez.
function TableroCarril({ leads, operacion }: { leads: Lead[]; operacion: TipoOperacion }) {
  const carriles = CARRILES[operacion].filter((c) => leads.some((l) => l.carril === c));
  return (
    <div className="space-y-3">
      {carriles.map((carril) => {
        const propios = leads.filter((l) => l.carril === carril);
        const monto = propios.reduce((s, l) => s + l.presupuesto, 0);
        return (
          <section key={carril} className="rounded-2xl border border-line bg-card/60">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: CARRIL_COLOR[carril] }}
                />
                <span className="text-[13.5px] font-bold text-[var(--text)]">
                  {CARRIL_NOMBRE[carril]}
                </span>
              </span>
              <span className="text-[12px] font-semibold text-[var(--text-3)]">
                {propios.length} · {plata(monto, operacion, true)}
              </span>
              <span className="text-[11.5px] text-[var(--text-3)]">{CARRIL_DETALLE[carril]}</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto p-2.5">
              {ETAPAS.map((etapa) => {
                const celda = ordenar(propios.filter((l) => l.etapa === etapa));
                return (
                  <div key={etapa} className="w-[212px] shrink-0">
                    <p className="mb-1.5 flex items-baseline justify-between gap-2 px-1 text-[11.5px] font-semibold text-[var(--text-3)]">
                      {nombreEtapa(etapa, operacion)}
                      <span className="text-[var(--text-2)]">{celda.length}</span>
                    </p>
                    <div className="space-y-2">
                      {celda.map((l) => (
                        <TarjetaLead key={l.id} lead={l} compacta />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function TarjetaLead({ lead, compacta = false }: { lead: Lead; compacta?: boolean }) {
  const { Icon, label } = CANAL[lead.canal];
  const u = URGENCIA[lead.urgencia];
  const onAgendar = useContext(AbrirAgenda);
  return (
    <article className="rounded-xl border border-line bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-bold leading-tight text-[var(--text)]">{lead.nombre}</p>
        <Icon size={14} className="mt-0.5 shrink-0 text-[var(--text-3)]" aria-label={label} />
      </div>
      <p className="mt-1 text-[13px] font-extrabold text-brand">
        {plata(lead.presupuesto, lead.operacion)}
      </p>
      <p className="text-[11.5px] leading-snug text-[var(--text-2)]">
        {lead.zona} · {lead.busca}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ color: CARRIL_COLOR[lead.carril], backgroundColor: "var(--surface-2)" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: CARRIL_COLOR[lead.carril] }}
          />
          {CARRIL_NOMBRE[lead.carril]}
        </span>
        <span className={cn("inline-flex items-center gap-1.5 text-[11px]", u.texto)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", u.punto)} />
          {desdeHace(lead.dias)}
        </span>
      </div>
      {/* En alquiler, cuándo se muda vale tanto como el presupuesto. */}
      {lead.operacion === "alquiler" && lead.mudanza !== "sin_definir" && (
        <p
          className={cn(
            "mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold",
            lead.mudanza === "inmediata" ? "text-[var(--brand-accent)]" : "text-[var(--text-3)]",
          )}
        >
          <CalendarClock size={12} />
          {lead.mudanza === "inmediata"
            ? MUDANZA_NOMBRE.inmediata
            : `La necesita el ${fechaCorta(lead.mudanzaEl ?? "")}`}
        </p>
      )}
      {/* La visita ya agendada, con el día y la hora que ve el calendario: es el
          mismo dato, no una copia. */}
      {lead.etapa === "visita" && lead.visita && (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[11.5px] font-semibold text-[var(--text-2)]">
          <CalendarClock size={12} className="text-brand" />
          {fechaCorta(lead.visita.fecha ?? "")} {horaHablada(lead.visita.hora)}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10.5px] font-bold",
              lead.visita.confirmada
                ? "bg-[var(--brand-green)]/15 text-[var(--brand-green)]"
                : "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]",
            )}
          >
            {lead.visita.confirmada ? "Confirmada" : "Sin confirmar"}
          </span>
        </p>
      )}
      {!compacta && lead.nota && (
        <p className="mt-2 border-t border-line pt-1.5 text-[11.5px] leading-snug text-[var(--text-3)]">
          {lead.nota}
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {lead.propiedadId && (
          <Link
            href={`/cartera/${lead.propiedadId}`}
            className="text-[11.5px] font-semibold text-brand underline underline-offset-2 hover:brightness-110"
          >
            Ver la propiedad
          </Link>
        )}
        {lead.etapa !== "cerrado" && (
          <button
            type="button"
            onClick={() => onAgendar(lead)}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand underline underline-offset-2 hover:brightness-110"
          >
            <CalendarClock size={12} />
            {lead.etapa === "visita" ? "Cambiar la visita" : "Agendar visita"}
          </button>
        )}
      </div>
    </article>
  );
}

// Agendar desde la ficha del lead: propiedad, día y hora. Al guardar, el lead se
// mueve a "Visita agendada" y aparece en el calendario. Una sola fuente.
function DialogoVisita({
  lead,
  onCerrar,
  onListo,
}: {
  lead: Lead;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const [propiedades, setPropiedades] = useState<Propiedad[]>([]);
  const [propiedadId, setPropiedadId] = useState(lead.visita?.propiedadId ?? lead.propiedadId ?? "");
  const [fecha, setFecha] = useState(lead.visita?.fecha ?? "");
  const [hora, setHora] = useState(lead.visita?.hora ?? "10:00");
  const [confirmada, setConfirmada] = useState(lead.visita?.confirmada ?? false);
  const [nota, setNota] = useState(lead.visita?.nota ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/inmobiliaria/cartera", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        // Solo lo que se puede enseñar hoy, y de la operación del cliente: a
        // quien busca alquiler no se le ofrece una casa en venta.
        const utiles = (d.cartera.propiedades as Propiedad[]).filter(
          (p) => p.estado !== "vendida" && p.operacion === lead.operacion,
        );
        setPropiedades(utiles);
        setPropiedadId((x) => x || utiles[0]?.id || "");
      })
      .catch(() => setError("No se pudo leer la cartera."));
  }, [lead.operacion]);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const r = await fetch("/api/inmobiliaria/visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, propiedadId, fecha, hora, confirmada, nota }),
      });
      const d = await r.json();
      if (!d.ok) setError(d.error ?? "No se pudo agendar.");
      else onListo();
    } catch {
      setError("No se pudo agendar.");
    }
    setGuardando(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-[440px] overflow-y-auto rounded-t-2xl border border-line bg-card p-5 sm:rounded-2xl">
        <h2 className="text-[16px] font-extrabold text-[var(--text)]">
          Visita de {lead.nombre}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--text-3)]">
          {lead.zona} · {lead.busca}
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-[13px] font-bold text-[var(--text-2)]">Propiedad</span>
          <select
            value={propiedadId}
            onChange={(e) => setPropiedadId(e.target.value)}
            className="h-[48px] w-full rounded-xl border-2 border-line bg-surface px-3 text-[15px] font-semibold text-[var(--text)] outline-none focus:border-brand [color-scheme:light]"
          >
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {p.codigo} · {p.zona}, {p.municipio}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-[var(--text-2)]">Día</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-[48px] w-full rounded-xl border-2 border-line bg-surface px-3 text-[15px] font-semibold text-[var(--text)] outline-none focus:border-brand [color-scheme:light]"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-bold text-[var(--text-2)]">Hora</span>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="h-[48px] w-full rounded-xl border-2 border-line bg-surface px-3 text-[15px] font-semibold text-[var(--text)] outline-none focus:border-brand [color-scheme:light]"
            />
          </label>
        </div>

        <button
          type="button"
          onClick={() => setConfirmada(!confirmada)}
          aria-pressed={confirmada}
          className={cn(
            "mt-3 flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border-2 px-3.5 text-left",
            confirmada ? "border-brand bg-brand/[0.06]" : "border-line bg-surface",
          )}
        >
          <span>
            <span className="block text-[14.5px] font-bold text-[var(--text)]">
              El cliente ya confirmó
            </span>
            <span className="block text-[12px] text-[var(--text-3)]">
              {confirmada ? "Dijo que ahí va a estar" : "Todavía hay que llamarlo"}
            </span>
          </span>
          <span
            className={cn(
              "flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition",
              confirmada ? "bg-brand" : "bg-[var(--border-2)]",
            )}
          >
            <span className={cn("h-5 w-5 rounded-full bg-white transition", confirmada && "translate-x-5")} />
          </span>
        </button>

        <label className="mt-3 block">
          <span className="mb-1 block text-[13px] font-bold text-[var(--text-2)]">Nota</span>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Llega con su esposa, entrar por la garita"
            className="h-[48px] w-full rounded-xl border-2 border-line bg-surface px-3 text-[15px] text-[var(--text)] outline-none focus:border-brand"
          />
        </label>

        {error && (
          <p className="mt-3 rounded-xl border border-[var(--brand-red)]/45 bg-[var(--brand-red)]/[0.07] px-3 py-2 text-[12.5px] font-semibold text-[var(--brand-red)]">
            {error}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="min-h-[48px] flex-1 rounded-xl border-2 border-line bg-card text-[14.5px] font-bold text-[var(--text-2)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={guardar}
            disabled={guardando || !propiedadId || !fecha || !hora}
            className="min-h-[48px] flex-[1.3] rounded-xl bg-brand text-[14.5px] font-extrabold text-white shadow-sm shadow-brand/30 disabled:opacity-60"
          >
            {guardando ? "Guardando" : "Agendar"}
          </button>
        </div>
      </div>
    </div>
  );
}
