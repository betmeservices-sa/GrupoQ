"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Facebook,
  Instagram,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";
import { dineroCorto, dinero, desdeHace } from "@/lib/inmobiliaria-formato";
import {
  ETAPAS,
  ETAPA_NOMBRE,
  FORMAS_PAGO,
  FORMA_PAGO_DETALLE,
  FORMA_PAGO_NOMBRE,
  type CanalLead,
  type Etapa,
  type FormaPago,
  type Lead,
  type Pipeline,
  type Urgencia,
} from "@/lib/inmobiliaria-tipos";

const CANAL: Record<CanalLead, { Icon: LucideIcon; label: string }> = {
  whatsapp: { Icon: MessageCircle, label: "WhatsApp" },
  messenger: { Icon: Facebook, label: "Messenger" },
  instagram: { Icon: Instagram, label: "Instagram" },
  comentario: { Icon: MessageSquare, label: "Comentario" },
};

const PAGO_COLOR: Record<FormaPago, string> = {
  contado: "var(--brand-green)",
  fsv: "var(--brand-blue)",
  banco: "var(--brand-accent)",
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
  no_calificado: "No puede comprar todavía. Vuelven en meses.",
};

export default function PipelinePage() {
  const router = useRouter();
  const esInmobiliaria = activeTenantId() === "inmobiliaria";
  useEffect(() => {
    if (!esInmobiliaria) router.replace("/");
  }, [esInmobiliaria, router]);

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<"etapas" | "pago">("etapas");
  const [filtro, setFiltro] = useState<FormaPago | "todas">("todas");
  const [soloFrios, setSoloFrios] = useState(false);

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

  const visibles = useMemo(() => {
    if (!pipeline) return [];
    return pipeline.leads.filter(
      (l) =>
        (filtro === "todas" || l.formaPago === filtro) &&
        (!soloFrios || (l.etapa !== "cerrado" && l.urgencia !== "al_dia")),
    );
  }, [pipeline, filtro, soloFrios]);

  if (!esInmobiliaria) return <div className="flex-1 bg-surface" />;

  const activos = visibles.filter((l) => l.etapa !== "cerrado").length;
  const enJuego = visibles
    .filter((l) => l.etapa !== "cerrado" && l.etapa !== "no_calificado")
    .reduce((s, l) => s + l.presupuesto, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Pipeline</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            {pipeline
              ? `${activos} en juego por ${dinero(enJuego)}`
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
            {/* Forma de pago: cuántos y cuánto. Cada tarjeta filtra el tablero. */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <TarjetaPago
                activa={filtro === "todas"}
                onClick={() => setFiltro("todas")}
                titulo="Todas"
                detalle="Sin filtrar"
                leads={pipeline.leads.length}
                monto={pipeline.porFormaPago.reduce((s, f) => s + f.monto, 0)}
                color="var(--text-2)"
              />
              {pipeline.porFormaPago.map((f) => (
                <TarjetaPago
                  key={f.formaPago}
                  activa={filtro === f.formaPago}
                  onClick={() => setFiltro(filtro === f.formaPago ? "todas" : f.formaPago)}
                  titulo={FORMA_PAGO_NOMBRE[f.formaPago]}
                  detalle={FORMA_PAGO_DETALLE[f.formaPago]}
                  leads={f.leads}
                  monto={f.monto}
                  color={PAGO_COLOR[f.formaPago]}
                />
              ))}
            </div>

            <div className="mt-4 mb-4 flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl border border-line bg-card p-0.5">
                {(["etapas", "pago"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVista(v)}
                    className={cn(
                      "rounded-[10px] px-3 py-1.5 text-[12.5px] font-semibold transition",
                      vista === v
                        ? "bg-brand text-white shadow-sm shadow-brand/25"
                        : "text-[var(--text-2)] hover:bg-surface",
                    )}
                  >
                    {v === "etapas" ? "Por etapa" : "Por forma de pago"}
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

            {vista === "etapas" ? (
              <TableroEtapas leads={visibles} />
            ) : (
              <TableroPago leads={visibles} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TarjetaPago({
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
  monto: number;
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
        <span className="ml-2 align-middle text-[13px] font-bold text-brand">
          {dineroCorto(monto)}
        </span>
      </p>
      <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--text-3)]">{detalle}</p>
    </button>
  );
}

function ordenar(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => b.dias - a.dias || b.presupuesto - a.presupuesto);
}

function TableroEtapas({ leads }: { leads: Lead[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {ETAPAS.map((etapa) => {
        const propios = ordenar(leads.filter((l) => l.etapa === etapa));
        const monto = propios.reduce((s, l) => s + l.presupuesto, 0);
        return (
          <div key={etapa} className="w-[268px] shrink-0 rounded-2xl border border-line bg-card/60">
            <div className="border-b border-line px-3.5 py-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-bold text-[var(--text)]">{ETAPA_NOMBRE[etapa]}</p>
                <p className="text-[12px] font-semibold text-[var(--text-3)]">
                  {propios.length} · {dineroCorto(monto)}
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

// Forma de pago en filas, etapas en columnas: las dos dimensiones a la vez.
function TableroPago({ leads }: { leads: Lead[] }) {
  const carriles = FORMAS_PAGO.filter((p) => leads.some((l) => l.formaPago === p));
  return (
    <div className="space-y-3">
      {carriles.map((pago) => {
        const propios = leads.filter((l) => l.formaPago === pago);
        const monto = propios.reduce((s, l) => s + l.presupuesto, 0);
        return (
          <section key={pago} className="rounded-2xl border border-line bg-card/60">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: PAGO_COLOR[pago] }}
                />
                <span className="text-[13.5px] font-bold text-[var(--text)]">
                  {FORMA_PAGO_NOMBRE[pago]}
                </span>
              </span>
              <span className="text-[12px] font-semibold text-[var(--text-3)]">
                {propios.length} · {dineroCorto(monto)}
              </span>
              <span className="text-[11.5px] text-[var(--text-3)]">
                {FORMA_PAGO_DETALLE[pago]}
              </span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto p-2.5">
              {ETAPAS.map((etapa) => {
                const celda = ordenar(propios.filter((l) => l.etapa === etapa));
                return (
                  <div key={etapa} className="w-[212px] shrink-0">
                    <p className="mb-1.5 flex items-baseline justify-between gap-2 px-1 text-[11.5px] font-semibold text-[var(--text-3)]">
                      {ETAPA_NOMBRE[etapa]}
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
  return (
    <article className="rounded-xl border border-line bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-bold leading-tight text-[var(--text)]">{lead.nombre}</p>
        <Icon size={14} className="mt-0.5 shrink-0 text-[var(--text-3)]" aria-label={label} />
      </div>
      <p className="mt-1 text-[13px] font-extrabold text-brand">{dinero(lead.presupuesto)}</p>
      <p className="text-[11.5px] leading-snug text-[var(--text-2)]">
        {lead.zona} · {lead.busca}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{
            color: PAGO_COLOR[lead.formaPago],
            backgroundColor: "var(--surface-2)",
          }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: PAGO_COLOR[lead.formaPago] }}
          />
          {FORMA_PAGO_NOMBRE[lead.formaPago]}
        </span>
        <span className={cn("inline-flex items-center gap-1.5 text-[11px]", u.texto)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", u.punto)} />
          {desdeHace(lead.dias)}
        </span>
      </div>
      {!compacta && lead.nota && (
        <p className="mt-2 border-t border-line pt-1.5 text-[11.5px] leading-snug text-[var(--text-3)]">
          {lead.nota}
        </p>
      )}
      {lead.propiedadId && (
        <Link
          href={`/cartera/${lead.propiedadId}`}
          className="mt-2 inline-block text-[11.5px] font-semibold text-brand underline underline-offset-2 hover:brightness-110"
        >
          Ver la propiedad
        </Link>
      )}
    </article>
  );
}
