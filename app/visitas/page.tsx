"use client";

// La agenda de visitas del agente. Abre en HOY y en orden de hora, porque esto
// se mira entre visita y visita, con el carro andando: lo primero que tiene que
// contestar es "a dónde voy ahora". El mes está a un toque, para ver la carga de
// la semana, pero no es lo que se abre primero.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Facebook,
  Instagram,
  MapPin,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";
import { fechaCorta, fechaLarga, precioDe } from "@/lib/inmobiliaria-formato";
import {
  armarMes,
  horaHablada,
  mesDe,
  sumarMeses,
  visitasDe,
  type Agenda,
  type Visita,
} from "@/lib/inmobiliaria-visitas";
import { TIPO_NOMBRE, type CanalLead } from "@/lib/inmobiliaria-tipos";

const CANAL: Record<CanalLead, { Icon: LucideIcon; label: string }> = {
  whatsapp: { Icon: MessageCircle, label: "Entró por WhatsApp" },
  messenger: { Icon: Facebook, label: "Entró por Messenger" },
  instagram: { Icon: Instagram, label: "Entró por Instagram" },
  comentario: { Icon: MessageSquare, label: "Entró por un comentario" },
};

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function VisitasPage() {
  const router = useRouter();
  const esInmobiliaria = activeTenantId() === "inmobiliaria";
  useEffect(() => {
    if (!esInmobiliaria) router.replace("/");
  }, [esInmobiliaria, router]);

  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<"dia" | "mes">("dia");
  const [dia, setDia] = useState<string | null>(null);
  const [mes, setMes] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/inmobiliaria/visitas", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) {
        setAgenda(d.agenda);
        setDia((x) => x ?? d.agenda.hoy);
        setMes((x) => x ?? mesDe(d.agenda.hoy));
        setError(null);
      } else {
        setError(d.error ?? "No se pudo leer la agenda.");
      }
    } catch {
      setError("No se pudo leer la agenda.");
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (esInmobiliaria) cargar();
  }, [cargar, esInmobiliaria]);

  const celdas = useMemo(
    () => (agenda && mes ? armarMes(agenda, `${mes}-01`) : []),
    [agenda, mes],
  );

  if (!esInmobiliaria) return <div className="flex-1 bg-surface" />;

  const delDia = agenda && dia ? visitasDe(agenda, dia) : [];
  const esHoy = Boolean(agenda && dia === agenda.hoy);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-4 py-3 sm:px-5">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Visitas</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            {agenda
              ? agenda.hoyVisitas.length > 0
                ? `${agenda.hoyVisitas.length} hoy · ${agenda.proximas.length} en los próximos días`
                : `Hoy no hay visitas · ${agenda.proximas.length} adelante`
              : "Cargando la agenda"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-line bg-card p-0.5">
            {([
              { id: "dia", label: "Día" },
              { id: "mes", label: "Mes" },
            ] as const).map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setVista(v.id)}
                className={cn(
                  "min-h-[36px] rounded-[10px] px-3 text-[12.5px] font-semibold transition",
                  vista === v.id
                    ? "bg-brand text-white shadow-sm shadow-brand/25"
                    : "text-[var(--text-2)] hover:bg-surface",
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={cargar}
            disabled={cargando}
            aria-label="Actualizar"
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-60"
          >
            <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {error && (
          <p className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[var(--brand-red)]/40 bg-[var(--brand-red)]/10 px-4 py-3 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {agenda && (
          <div className="mx-auto w-full max-w-[880px]">
            {(agenda.choques > 0 || agenda.sinConfirmar > 0) && (
              <div className="mb-4 flex flex-wrap gap-2">
                {agenda.choques > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-red)]/45 bg-[var(--brand-red)]/[0.08] px-3 py-1.5 text-[12.5px] font-bold text-[var(--brand-red)]">
                    <AlertCircle size={14} />
                    {agenda.choques === 1
                      ? "Una visita quedó demasiado pegada a la anterior"
                      : `${agenda.choques} visitas quedaron demasiado pegadas`}
                  </span>
                )}
                {agenda.sinConfirmar > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/[0.08] px-3 py-1.5 text-[12.5px] font-bold text-[var(--brand-accent)]">
                    {agenda.sinConfirmar === 1
                      ? "Una sin confirmar"
                      : `${agenda.sinConfirmar} sin confirmar`}
                  </span>
                )}
              </div>
            )}

            {vista === "dia" ? (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-label="Día anterior"
                    onClick={() => setDia(correrDia(dia ?? agenda.hoy, -1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-[var(--text-2)]"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <div className="text-center">
                    <p className="text-[15px] font-extrabold text-[var(--text)]">
                      {esHoy ? "Hoy" : fechaLarga(dia ?? "")}
                    </p>
                    <p className="text-[12.5px] text-[var(--text-3)] first-letter:uppercase">
                      {esHoy ? fechaLarga(dia ?? "") : diaSemana(dia ?? "")}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Día siguiente"
                    onClick={() => setDia(correrDia(dia ?? agenda.hoy, 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-[var(--text-2)]"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                {!esHoy && (
                  <button
                    type="button"
                    onClick={() => setDia(agenda.hoy)}
                    className="mb-3 w-full rounded-xl border border-line bg-card py-2 text-[13px] font-bold text-brand"
                  >
                    Volver a hoy
                  </button>
                )}

                {delDia.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[var(--border-2)] px-4 py-10 text-center text-[13px] text-[var(--text-2)]">
                    Sin visitas este día.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {delDia.map((v) => (
                      <li key={v.id}>
                        <TarjetaVisita v={v} />
                      </li>
                    ))}
                  </ul>
                )}

                {esHoy && agenda.proximas.length > 0 && (
                  <section className="mt-6">
                    <h2 className="mb-2 text-[14px] font-extrabold text-[var(--text)]">
                      Lo que viene
                    </h2>
                    <ul className="space-y-2">
                      {agenda.proximas.slice(0, 6).map((v) => (
                        <li key={v.id}>
                          <button
                            type="button"
                            onClick={() => setDia(v.fecha)}
                            className="flex w-full items-center gap-3 rounded-xl border border-line bg-card px-3.5 py-2.5 text-left transition hover:border-[var(--border-2)]"
                          >
                            <span className="w-[86px] shrink-0">
                              <span className="block text-[12.5px] font-bold text-brand">
                                {fechaCorta(v.fecha)}
                              </span>
                              <span className="block text-[12px] text-[var(--text-3)]">
                                {horaHablada(v.hora)}
                              </span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13.5px] font-bold text-[var(--text)]">
                                {v.cliente}
                              </span>
                              <span className="block truncate text-[12px] text-[var(--text-3)]">
                                {v.codigo} · {v.zona}
                              </span>
                            </span>
                            {!v.confirmada && (
                              <span className="shrink-0 rounded-full bg-[var(--brand-accent)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--brand-accent)]">
                                Sin confirmar
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-label="Mes anterior"
                    onClick={() => setMes(sumarMeses(mes ?? mesDe(agenda.hoy), -1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-[var(--text-2)]"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <p className="text-[15px] font-extrabold text-[var(--text)] first-letter:uppercase">
                    {nombreMes(mes ?? "")}
                  </p>
                  <button
                    type="button"
                    aria-label="Mes siguiente"
                    onClick={() => setMes(sumarMeses(mes ?? mesDe(agenda.hoy), 1))}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-card text-[var(--text-2)]"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>

                <div className="overflow-hidden rounded-2xl border border-line bg-card">
                  <div className="grid grid-cols-7 border-b border-line">
                    {DIAS.map((d) => (
                      <p
                        key={d}
                        className="py-2 text-center text-[11.5px] font-bold uppercase tracking-wide text-[var(--text-3)]"
                      >
                        {d}
                      </p>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {celdas.map((c) => (
                      <button
                        key={c.fecha}
                        type="button"
                        onClick={() => {
                          setDia(c.fecha);
                          setVista("dia");
                        }}
                        className={cn(
                          "flex min-h-[68px] flex-col items-center gap-1 border-b border-r border-line p-1.5 text-center transition last:border-r-0 hover:bg-surface",
                          !c.delMes && "opacity-40",
                          c.esHoy && "bg-brand/[0.07]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold",
                            c.esHoy ? "bg-brand text-white" : "text-[var(--text-2)]",
                          )}
                        >
                          {Number(c.fecha.slice(8))}
                        </span>
                        {c.visitas > 0 && (
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[11px] font-bold",
                              c.choques > 0
                                ? "bg-[var(--brand-red)] text-white"
                                : c.sinConfirmar > 0
                                  ? "bg-[var(--brand-accent)]/20 text-[var(--brand-accent)]"
                                  : "bg-[var(--brand-green)]/15 text-[var(--brand-green)]",
                            )}
                          >
                            {c.visitas}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--text-3)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-green)]/50" /> todas confirmadas
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-accent)]" /> falta confirmar
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--brand-red)]" /> quedaron pegadas
                  </span>
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TarjetaVisita({ v }: { v: Visita }) {
  const { Icon, label } = CANAL[v.canal];
  return (
    <article
      className={cn(
        "rounded-2xl border-2 bg-card p-4",
        v.choque ? "border-[var(--brand-red)]/50" : "border-line",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-[74px] shrink-0">
          <p className="text-[17px] font-extrabold leading-tight tracking-tight text-brand">
            {horaHablada(v.hora).replace(" ", " ")}
          </p>
          <p className="text-[11.5px] text-[var(--text-3)]">{v.duracionMin} min</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[15px] font-extrabold leading-tight text-[var(--text)]">{v.cliente}</p>
            <Icon size={15} className="mt-0.5 shrink-0 text-[var(--text-3)]" aria-label={label} />
          </div>
          <p className="mt-0.5 text-[13px] text-[var(--text-2)]">{v.telefonoBusca}</p>

          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-semibold text-[var(--text-2)]">
            <MapPin size={14} className="shrink-0 text-brand" />
            {v.zona}, {v.municipio}
          </p>
          <p className="text-[12.5px] text-[var(--text-3)]">
            {v.codigo} · {TIPO_NOMBRE[v.tipo]} {v.operacion === "alquiler" ? "en alquiler" : "en venta"} ·{" "}
            {precioDe({ operacion: v.operacion, precio: v.precio })}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11.5px] font-bold",
                v.confirmada
                  ? "bg-[var(--brand-green)]/15 text-[var(--brand-green)]"
                  : "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]",
              )}
            >
              {v.confirmada ? "Confirmada" : "Sin confirmar"}
            </span>
            <Link
              href={`/cartera/${v.propiedadId}`}
              className="text-[12.5px] font-semibold text-brand underline underline-offset-2"
            >
              Ver la propiedad
            </Link>
          </div>

          {v.nota && (
            <p className="mt-2 text-[12.5px] leading-snug text-[var(--text-3)]">{v.nota}</p>
          )}

          {v.choque && (
            <p className="mt-2 flex items-start gap-2 rounded-xl border border-[var(--brand-red)]/45 bg-[var(--brand-red)]/[0.07] px-3 py-2 text-[12.5px] font-semibold text-[var(--brand-red)]">
              <Clock size={14} className="mt-0.5 shrink-0" />
              {v.choque}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function correrDia(fecha: string, delta: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() + delta);
  return t.toISOString().slice(0, 10);
}

function diaSemana(fecha: string): string {
  if (!fecha) return "";
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { weekday: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, d)),
  );
}

function nombreMes(mes: string): string {
  if (!mes) return "";
  const [a, m] = mes.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, 1)),
  );
}
