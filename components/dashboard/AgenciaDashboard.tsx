"use client";

// El tablero de la agencia: un cliente a la vez.
//
// Arriba, una pestaña por cliente (Yali primero, es el cliente oficial). Al
// elegir uno se ve SOLO lo suyo: cuánto costó el agente de IA en el periodo,
// cuántas respuestas mandó, a cuántas conversaciones, cuánto sale cada
// respuesta, si la caché está trabajando, por canal, por día u hora, y el
// detalle por conversación. Debajo, sus tickets, su gente y sus accesos.
//
// Los periodos (hoy, ayer, semana, mes, rango) se cortan en hora de El
// Salvador en el servidor; acá solo se pintan.

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  CircleDollarSign,
  Coins,
  Database,
  KeyRound,
  Loader2,
  MessageSquareText,
  Mic,
  RefreshCw,
  TicketCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { PERIODOS, type Canal, type Periodo, type ReporteConsumo } from "@/lib/agencia-consumo";

interface Usuario {
  usuario: string;
  nombre: string;
  rol: string;
  ultimoLogin: string | null;
  ultimoVisto: string | null;
  activo: boolean;
  logins: number;
}

interface Cliente {
  id: string;
  nombre: string;
  oficial: boolean;
  tokens: { respuestas: number; costo: number; costoTotalHistorico: number };
  tickets: { total: number; periodo: number; abiertos: number; resueltos: number; porSofia: number; porTipo: { tipo: string; n: number }[] };
  usuarios: Usuario[];
  activosAhora: number;
}

interface Acceso {
  ts: string;
  tenant: string;
  cliente: string;
  usuario: string;
  nombre: string | null;
  rol: string | null;
  host: string | null;
  ip: string | null;
  activo: boolean;
}

interface Resumen {
  dias: number;
  clientes: Cliente[];
  accesos: Acceso[];
}

type Reporte = ReporteConsumo & { cliente: { id: string; nombre: string }; filasLeidas: number };

const ROL: Record<string, string> = {
  admin: "Administrador",
  jefe: "Dirección",
  gerente_marketing: "Gerente",
  atencion: "Atención",
  marketing: "Marketing",
  recepcion: "Recepción",
  medico: "Médico",
};

const CANAL: Record<Canal, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  facebook: "Facebook",
  otro: "Otro",
};

const TZ = "America/El_Salvador";
const DIAS_RESUMEN = 30;
const CLIENTE_INICIAL = "yaly";

function dinero(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Para montos chicos (una respuesta cuesta centavos): más decimales. */
function dineroFino(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(5)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return dinero(n);
}

function miles(n: number): string {
  return n.toLocaleString("en-US");
}

/** 1.234.567 tokens se leen mejor como "1.2M"; menos de 10k, tal cual. */
function tokensCortos(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return miles(n);
}

function hace(iso: string | null): string {
  if (!iso) return "nunca";
  const ms = Date.now() - Date.parse(iso);
  const min = Math.round(ms / 60000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-SV", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleString("es-SV", { timeZone: TZ, day: "numeric", month: "short" });
}

/**
 * Cambio porcentual contra el periodo anterior. Sin base no hay comparación, y
 * arriba de 999% tampoco: arrancar de casi cero da "+17943%", que no dice nada
 * y se lee como un error. En esos casos no se pinta el globo y quedan los
 * números, que sí se entienden.
 */
function delta(actual: number, anterior: number): number | undefined {
  if (anterior <= 0) return undefined;
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  return Math.abs(pct) > 999 ? undefined : pct;
}

/** "2026-09-02" del día de hoy en El Salvador, para el rango por defecto. */
function hoySV(corrimientoDias = 0): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(Date.now() + corrimientoDias * 86_400_000),
  );
}

export function AgenciaDashboard() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [cliente, setCliente] = useState(CLIENTE_INICIAL);
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [desde, setDesde] = useState(() => hoySV(-6));
  const [hasta, setHasta] = useState(() => hoySV());
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrica, setMetrica] = useState<"respuestas" | "costo">("respuestas");

  const cargarResumen = useCallback(async () => {
    try {
      const r = await fetch(`/api/agencia/resumen?dias=${DIAS_RESUMEN}`, { cache: "no-store" });
      const d = (await r.json()) as Resumen & { ok: boolean; error?: string };
      if (d.ok) setResumen(d);
      else setError(d.error ?? "No se pudo leer.");
    } catch {
      setError("No se pudo leer.");
    }
  }, []);

  const cargarReporte = useCallback(async () => {
    if (periodo === "rango" && (!desde || !hasta || hasta < desde)) return;
    setCargando(true);
    try {
      const q = new URLSearchParams({ cliente, periodo });
      if (periodo === "rango") {
        q.set("desde", desde);
        q.set("hasta", hasta);
      }
      const r = await fetch(`/api/agencia/consumo?${q}`, { cache: "no-store" });
      const d = (await r.json()) as Reporte & { ok: boolean; error?: string };
      if (d.ok) {
        setReporte(d);
        setError(null);
      } else setError(d.error ?? "No se pudo leer.");
    } catch {
      setError("No se pudo leer.");
    } finally {
      setCargando(false);
    }
  }, [cliente, periodo, desde, hasta]);

  useEffect(() => {
    void cargarResumen();
    const t = setInterval(() => void cargarResumen(), 60_000);
    return () => clearInterval(t);
  }, [cargarResumen]);

  useEffect(() => {
    void cargarReporte();
    const t = setInterval(() => void cargarReporte(), 60_000);
    return () => clearInterval(t);
  }, [cargarReporte]);

  // La agencia no se reporta a sí misma. Yali va primero; luego los que tienen algo.
  const clientes = (resumen?.clientes ?? []).filter((c) => c.id !== "miagentia");
  const seleccionado = clientes.find((c) => c.id === cliente) ?? null;
  const accesos = (resumen?.accesos ?? []).filter((a) => a.tenant === cliente);
  const conUso = (c: Cliente) => c.oficial || c.tokens.respuestas > 0 || c.tickets.total > 0 || c.usuarios.length > 0;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-3">
          <div>
            <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Agencia</h1>
            <p className="text-[12.5px] text-[var(--text-3)]">Agente de IA, tickets y accesos, cliente por cliente</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void cargarResumen();
              void cargarReporte();
            }}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-60"
          >
            <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
            Actualizar
          </button>
        </div>

        <nav className="mt-2 flex gap-1 overflow-x-auto px-5" aria-label="Clientes">
          {(clientes.length ? clientes : [{ id: CLIENTE_INICIAL, nombre: "YALÍ", oficial: true } as Cliente]).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCliente(c.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold transition",
                cliente === c.id ? "border-brand text-brand" : "border-transparent text-[var(--text-3)] hover:text-[var(--text)]",
                !conUso(c) && cliente !== c.id && "opacity-60",
              )}
            >
              {c.nombre}
              {c.oficial && <span className="h-1.5 w-1.5 rounded-full bg-brand" title="Cliente oficial" />}
            </button>
          ))}
        </nav>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
            {PERIODOS.map((p) => (
              <button
                key={p.clave}
                type="button"
                onClick={() => setPeriodo(p.clave)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition",
                  periodo === p.clave ? "bg-brand text-white shadow-sm" : "text-[var(--text-2)] hover:bg-card",
                )}
              >
                {p.etiqueta}
              </button>
            ))}
          </div>
          {periodo === "rango" && (
            <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-2)]">
              <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className="rounded-lg border border-line bg-card px-2 py-1.5" />
              <span>a</span>
              <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} className="rounded-lg border border-line bg-card px-2 py-1.5" />
            </div>
          )}
          {reporte && (
            <span className="ml-auto text-[12px] text-[var(--text-3)]">
              {fechaCorta(reporte.periodo.desde)}
              {reporte.periodo.clave !== "hoy" && reporte.periodo.clave !== "ayer" && ` a ${fechaCorta(new Date(Date.parse(reporte.periodo.hasta) - 1).toISOString())}`}
              {" · comparado con "}
              {fechaCorta(reporte.periodo.anterior.desde)}
              {reporte.periodo.clave !== "hoy" && reporte.periodo.clave !== "ayer" && ` a ${fechaCorta(new Date(Date.parse(reporte.periodo.anterior.hasta) - 1).toISOString())}`}
            </span>
          )}
        </div>

        {error && <p className="rounded-xl border border-[var(--brand-red)]/40 bg-[var(--brand-red)]/10 px-3.5 py-2.5 text-[12.5px]">{error}</p>}
        {cargando && !reporte && (
          <p className="flex items-center gap-2 text-[13px] text-[var(--text-3)]">
            <Loader2 size={15} className="animate-spin text-brand" /> Leyendo el consumo
          </p>
        )}

        {reporte && reporte.cliente.id === cliente && <Consumo r={reporte} metrica={metrica} setMetrica={setMetrica} />}

        {seleccionado && <TicketsYGente c={seleccionado} />}

        {resumen && (
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--text)]">
              <KeyRound size={15} className="text-brand" /> Accesos al panel · {DIAS_RESUMEN} días
            </h2>
            {accesos.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-[var(--text-3)]">Nadie de {seleccionado?.nombre ?? "este cliente"} ha entrado en los últimos {DIAS_RESUMEN} días.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                    <tr className="text-left">
                      <th className="py-1.5 pr-3 font-semibold">Cuándo</th>
                      <th className="py-1.5 pr-3 font-semibold">Quién</th>
                      <th className="py-1.5 pr-3 font-semibold">Desde</th>
                      <th className="py-1.5 font-semibold">Ahora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accesos.map((a, i) => (
                      <tr key={`${a.ts}-${i}`} className="border-t border-line">
                        <td className="whitespace-nowrap py-2 pr-3 text-[var(--text-2)]">{fechaHora(a.ts)}</td>
                        <td className="py-2 pr-3">
                          <span className="font-semibold text-[var(--text)]">{a.nombre ?? a.usuario}</span>
                          <span className="block text-[11px] text-[var(--text-3)]">
                            {a.usuario}
                            {a.rol ? ` · ${ROL[a.rol] ?? a.rol}` : ""}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-[var(--text-3)]">{[a.host, a.ip].filter(Boolean).join(" · ") || "sin dato"}</td>
                        <td className="py-2">{a.activo ? <Pastilla verde>Activo</Pastilla> : <span className="text-[var(--text-3)]">·</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Consumo({ r, metrica, setMetrica }: { r: Reporte; metrica: "respuestas" | "costo"; setMetrica: (m: "respuestas" | "costo") => void }) {
  const a = r.actual;
  const ant = r.anterior;
  const tk = a.tokens;
  const vacio = a.respuestas === 0 && a.transcripciones.cantidad === 0;
  const maxSerie = Math.max(0.0001, ...r.serie.map((p) => (metrica === "costo" ? p.costo : p.respuestas)));
  const cadaN = Math.max(1, Math.ceil(r.serie.length / (r.periodo.granularidad === "hora" ? 6 : 10)));

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label={`Costo del agente · ${r.periodo.etiqueta.toLowerCase()}`} valor={dinero(a.costo)} delta={delta(a.costo, ant.costo)} Icon={CircleDollarSign} />
        <MetricCard label="Respuestas enviadas" valor={miles(a.respuestas)} delta={delta(a.respuestas, ant.respuestas)} Icon={Bot} />
        <MetricCard label="Conversaciones atendidas" valor={miles(a.conversaciones)} delta={delta(a.conversaciones, ant.conversaciones)} Icon={MessageSquareText} />
        <MetricCard label="Costo por respuesta" valor={dineroFino(a.costoPorRespuesta)} delta={delta(a.costoPorRespuesta, ant.costoPorRespuesta)} Icon={Coins} />
      </div>

      {vacio ? (
        <section className="rounded-2xl border border-line bg-card p-5 text-[13px] text-[var(--text-3)]">
          El agente no respondió nada de {r.cliente.nombre} en este periodo.
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Tarjeta titulo="Respuestas por conversación" Icon={MessageSquareText}>
              <p className="text-[24px] font-extrabold tracking-tight text-[var(--text)]">{a.respuestasPorConversacion.toFixed(1)}</p>
              <p className="text-[12px] text-[var(--text-2)]">
                antes {ant.respuestasPorConversacion.toFixed(1)}
                {a.imagenes > 0 && ` · ${a.imagenes} ${a.imagenes === 1 ? "imagen leída" : "imágenes leídas"}`}
              </p>
              {a.transcripciones.cantidad > 0 && (
                <p className="mt-1 flex items-center gap-1 text-[12px] text-[var(--text-3)]">
                  <Mic size={12} /> {a.transcripciones.cantidad} {a.transcripciones.cantidad === 1 ? "nota de voz transcrita" : "notas de voz transcritas"} · {dineroFino(a.transcripciones.costo)}
                </p>
              )}
            </Tarjeta>

            <Tarjeta titulo="Tokens" Icon={Coins}>
              <p className="text-[24px] font-extrabold tracking-tight text-[var(--text)]">{tokensCortos(tk.total)}</p>
              <p className="text-[12px] text-[var(--text-2)]">
                {tokensCortos(tk.entrada)} de entrada · {tokensCortos(tk.salida)} de salida
              </p>
              <p className="text-[11.5px] text-[var(--text-3)]">
                entrada: {tokensCortos(tk.entradaSinCache)} normal · {tokensCortos(tk.cacheEscritura)} escribiendo caché · {tokensCortos(tk.cacheLectura)} leyendo caché
              </p>
              {r.modelos.length > 0 && (
                <p className="mt-1 truncate text-[11.5px] text-[var(--text-3)]" title={r.modelos.map((m) => `${m.modelo}: ${dineroFino(m.costo)}`).join("\n")}>
                  {r.modelos.map((m) => m.modelo).join(" · ")}
                </p>
              )}
            </Tarjeta>

            <Tarjeta titulo="Caché de prompt" Icon={Database}>
              <p className="flex items-center gap-2 text-[24px] font-extrabold tracking-tight text-[var(--text)]">
                {r.cache.encendida === null ? "Sin datos" : r.cache.encendida ? "Encendida" : "Apagada"}
                {r.cache.encendida !== null && (
                  <span className={cn("h-2.5 w-2.5 rounded-full", r.cache.encendida ? "bg-[#2f9e2f]" : "bg-[var(--brand-red)]")} />
                )}
              </p>
              {r.cache.encendida !== null && (
                <>
                  <p className="text-[12px] text-[var(--text-2)]">
                    {r.cache.pctEntradaDesdeCache}% de la entrada vino de caché · ahorró {dineroFino(r.cache.ahorro)}
                  </p>
                  <p className="text-[11.5px] text-[var(--text-3)]">
                    {r.cache.respuestasConCache} de {r.cache.respuestas} respuestas la usaron · últimas {r.cache.ultimas.total}: {r.cache.ultimas.conCache} con caché
                  </p>
                </>
              )}
            </Tarjeta>
          </div>

          <section className="rounded-2xl border border-line bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-bold text-[var(--text)]">{r.periodo.granularidad === "hora" ? "Por hora" : "Por día"}</h2>
              <div className="flex gap-1 rounded-lg border border-line bg-surface p-0.5">
                {(["respuestas", "costo"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMetrica(m)}
                    className={cn("rounded-md px-2.5 py-1 text-[12px] font-semibold transition", metrica === m ? "bg-brand text-white" : "text-[var(--text-2)] hover:bg-card")}
                  >
                    {m === "respuestas" ? "Respuestas" : "Costo"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 flex h-36 items-end gap-[3px]">
              {r.serie.map((p) => {
                const v = metrica === "costo" ? p.costo : p.respuestas;
                return (
                  <div
                    key={p.clave}
                    title={`${p.etiqueta}: ${p.respuestas} respuestas · ${p.conversaciones} conversaciones · ${dineroFino(p.costo)} · ${tokensCortos(p.tokens)} tokens`}
                    className={cn("min-w-[3px] flex-1 rounded-t transition-all", v > 0 ? "bg-brand/75 hover:bg-brand" : "bg-line/60")}
                    style={{ height: `${v > 0 ? Math.max(4, (v / maxSerie) * 100) : 2}%` }}
                  />
                );
              })}
            </div>
            <div className="mt-1 flex gap-[3px] text-[10.5px] text-[var(--text-3)]">
              {r.serie.map((p, i) => (
                <span key={p.clave} className="min-w-[3px] flex-1 truncate text-center">
                  {i % cadaN === 0 ? p.etiqueta : ""}
                </span>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_2fr]">
            <section className="rounded-2xl border border-line bg-card p-5">
              <h2 className="text-[15px] font-bold text-[var(--text)]">Por canal</h2>
              <table className="mt-3 w-full text-[12.5px]">
                <thead className="text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                  <tr className="text-left">
                    <th className="py-1.5 pr-3 font-semibold">Canal</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Conv.</th>
                    <th className="py-1.5 pr-3 text-right font-semibold">Resp.</th>
                    <th className="py-1.5 text-right font-semibold">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {r.canales.map((c) => (
                    <tr key={c.canal} className="border-t border-line">
                      <td className="py-2 pr-3 font-semibold text-[var(--text)]">{CANAL[c.canal]}</td>
                      <td className="py-2 pr-3 text-right text-[var(--text-2)]">{miles(c.conversaciones)}</td>
                      <td className="py-2 pr-3 text-right text-[var(--text-2)]">{miles(c.respuestas)}</td>
                      <td className="py-2 text-right text-[var(--text-2)]">{dineroFino(c.costo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="rounded-2xl border border-line bg-card p-5">
              <h2 className="text-[15px] font-bold text-[var(--text)]">Conversaciones · {r.conversaciones.length}</h2>
              <div className="mt-3 max-h-80 overflow-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                    <tr className="text-left">
                      <th className="py-1.5 pr-3 font-semibold">Contacto</th>
                      <th className="py-1.5 pr-3 font-semibold">Canal</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Resp.</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Tokens</th>
                      <th className="py-1.5 pr-3 text-right font-semibold">Costo</th>
                      <th className="py-1.5 font-semibold">Última</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.conversaciones.map((c) => (
                      <tr key={`${c.canal}-${c.id}`} className="border-t border-line">
                        <td className="whitespace-nowrap py-2 pr-3 font-semibold text-[var(--text)]">{c.id}</td>
                        <td className="py-2 pr-3 text-[var(--text-2)]">{CANAL[c.canal]}</td>
                        <td className="py-2 pr-3 text-right text-[var(--text-2)]">{c.respuestas}</td>
                        <td className="py-2 pr-3 text-right text-[var(--text-2)]">{tokensCortos(c.tokens)}</td>
                        <td className="py-2 pr-3 text-right text-[var(--text-2)]">{dineroFino(c.costo)}</td>
                        <td className="whitespace-nowrap py-2 text-[var(--text-3)]">{fechaHora(c.ultimo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}

function TicketsYGente({ c }: { c: Cliente }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            <TicketCheck size={12} /> Tickets · {DIAS_RESUMEN} días
          </p>
          <p className="text-[24px] font-extrabold tracking-tight text-[var(--text)]">
            {c.tickets.abiertos} <span className="text-[13px] font-semibold text-[var(--text-3)]">abiertos</span>
          </p>
          <p className="text-[12px] text-[var(--text-2)]">
            {c.tickets.periodo} nuevos · {c.tickets.resueltos} resueltos · {c.tickets.porSofia} abiertos por la IA
          </p>
          {c.tickets.porTipo.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-[11.5px] text-[var(--text-3)]">
              {c.tickets.porTipo.slice(0, 4).map((t) => (
                <li key={t.tipo}>
                  {t.tipo.replace(/_/g, " ")} · {t.n}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            <Users size={12} /> Personas con acceso
            {c.activosAhora > 0 && <Pastilla verde>{c.activosAhora} ahora</Pastilla>}
          </p>
          {c.usuarios.length === 0 ? (
            <p className="text-[12.5px] text-[var(--text-3)]">Sin cuentas propias (entra con la clave del cliente).</p>
          ) : (
            <ul className="space-y-1.5">
              {c.usuarios.map((u) => (
                <li key={u.usuario} className="flex items-center gap-2 text-[12.5px]">
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", u.activo ? "bg-[#2f9e2f]" : u.ultimoLogin ? "bg-[var(--brand-accent)]" : "bg-line")} />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-[var(--text)]">{u.nombre}</span>
                    <span className="text-[var(--text-3)]"> · {ROL[u.rol] ?? u.rol}</span>
                    <span className="block truncate text-[11px] text-[var(--text-3)]">
                      {u.activo ? "activo ahora" : u.ultimoVisto ? `visto ${hace(u.ultimoVisto)}` : "nunca ha entrado"}
                      {u.ultimoLogin ? ` · último login ${hace(u.ultimoLogin)} · ${u.logins} ${u.logins === 1 ? "acceso" : "accesos"}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function Tarjeta({ titulo, Icon, children }: { titulo: string; Icon: typeof Coins; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
        <Icon size={12} /> {titulo}
      </p>
      {children}
    </section>
  );
}

function Pastilla({ children, verde }: { children: React.ReactNode; verde?: boolean }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal", verde ? "bg-emerald-50 text-[#2f9e2f]" : "bg-surface text-[var(--text-3)]")}>
      {children}
    </span>
  );
}
