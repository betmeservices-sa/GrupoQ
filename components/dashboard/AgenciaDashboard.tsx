"use client";

// El tablero de la agencia: qué consume cada cliente y quién entra.
//
// Tres preguntas, en este orden: cuánto nos cuesta el agente de IA por cliente
// (tokens y dólares), cuántos tickets se están abriendo, y quién del cliente
// está usando el panel (último login, activo ahora). Yali va primero porque es
// el primer cliente oficial; los demás quedan compactos hasta que tengan uso.

import { useCallback, useEffect, useState } from "react";
import { Activity, Bot, CircleDollarSign, KeyRound, Loader2, RefreshCw, TicketCheck, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { MetricCard } from "@/components/dashboard/MetricCard";

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
  tokens: {
    respuestas: number;
    tokensEntrada: number;
    tokensSalida: number;
    costo: number;
    porDia: { dia: string; costo: number; respuestas: number }[];
    costoTotalHistorico: number;
  };
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

const ROL: Record<string, string> = {
  admin: "Administrador",
  jefe: "Dirección",
  gerente_marketing: "Gerente",
  atencion: "Atención",
  marketing: "Marketing",
  recepcion: "Recepción",
  medico: "Médico",
};

function dinero(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function miles(n: number): string {
  return n.toLocaleString("en-US");
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
  return new Date(iso).toLocaleString("es-SV", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
}

export function AgenciaDashboard() {
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`/api/agencia/resumen?dias=${dias}`, { cache: "no-store" });
      const d = (await r.json()) as Resumen & { ok: boolean; error?: string };
      if (d.ok) {
        setDatos(d);
        setError(null);
      } else setError(d.error ?? "No se pudo leer.");
    } catch {
      setError("No se pudo leer.");
    } finally {
      setCargando(false);
    }
  }, [dias]);

  useEffect(() => {
    void cargar();
    const t = setInterval(() => void cargar(), 60_000);
    return () => clearInterval(t);
  }, [cargar]);

  const clientes = datos?.clientes ?? [];
  const conUso = clientes.filter((c) => c.tokens.respuestas > 0 || c.tickets.total > 0 || c.usuarios.length > 0 || c.oficial);
  const sinUso = clientes.filter((c) => !conUso.includes(c));
  const costoTotal = clientes.reduce((s, c) => s + c.tokens.costo, 0);
  const respuestas = clientes.reduce((s, c) => s + c.tokens.respuestas, 0);
  const ticketsAbiertos = clientes.reduce((s, c) => s + c.tickets.abiertos, 0);
  const activos = clientes.reduce((s, c) => s + c.activosAhora, 0);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Agencia</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">Consumo por cliente, tickets y quién entra al panel</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
            {[7, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDias(d)}
                className={cn("rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition", dias === d ? "bg-brand text-white shadow-sm" : "text-[var(--text-2)] hover:bg-card")}
              >
                {d} días
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-60"
          >
            <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
            Actualizar
          </button>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {error && <p className="rounded-xl border border-[var(--brand-red)]/40 bg-[var(--brand-red)]/10 px-3.5 py-2.5 text-[12.5px]">{error}</p>}
        {cargando && !datos && (
          <p className="flex items-center gap-2 text-[13px] text-[var(--text-3)]">
            <Loader2 size={15} className="animate-spin text-brand" /> Leyendo consumo, tickets y accesos
          </p>
        )}

        {datos && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <MetricCard label={`Costo del agente · ${dias} días`} valor={dinero(costoTotal)} Icon={CircleDollarSign} />
              <MetricCard label="Respuestas de IA" valor={miles(respuestas)} Icon={Bot} />
              <MetricCard label="Tickets abiertos" valor={ticketsAbiertos} Icon={TicketCheck} />
              <MetricCard label="Personas en el panel ahora" valor={activos} Icon={Activity} />
            </div>

            {conUso.map((c) => (
              <ClienteCard key={c.id} c={c} dias={dias} />
            ))}

            {sinUso.length > 0 && (
              <section className="rounded-2xl border border-line bg-card p-5">
                <h2 className="text-[15px] font-bold text-[var(--text)]">Sin uso en este periodo</h2>
                <p className="mt-1 text-[12.5px] text-[var(--text-3)]">{sinUso.map((c) => c.nombre).join(" · ")}</p>
              </section>
            )}

            <section className="rounded-2xl border border-line bg-card p-5">
              <h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--text)]">
                <KeyRound size={15} className="text-brand" /> Accesos · últimos {dias} días
              </h2>
              <p className="text-[12.5px] text-[var(--text-3)]">Cada inicio de sesión: quién, de qué cliente, cuándo y desde dónde.</p>
              {datos.accesos.length === 0 ? (
                <p className="mt-3 text-[12.5px] text-[var(--text-3)]">Todavía no hay accesos registrados (empieza a contar desde hoy).</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead className="text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                      <tr className="text-left">
                        <th className="py-1.5 pr-3 font-semibold">Cuándo</th>
                        <th className="py-1.5 pr-3 font-semibold">Quién</th>
                        <th className="py-1.5 pr-3 font-semibold">Cliente</th>
                        <th className="py-1.5 pr-3 font-semibold">Desde</th>
                        <th className="py-1.5 font-semibold">Ahora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.accesos.map((a, i) => (
                        <tr key={`${a.ts}-${i}`} className="border-t border-line">
                          <td className="whitespace-nowrap py-2 pr-3 text-[var(--text-2)]">{fechaHora(a.ts)}</td>
                          <td className="py-2 pr-3">
                            <span className="font-semibold text-[var(--text)]">{a.nombre ?? a.usuario}</span>
                            <span className="block text-[11px] text-[var(--text-3)]">{a.usuario}{a.rol ? ` · ${ROL[a.rol] ?? a.rol}` : ""}</span>
                          </td>
                          <td className="py-2 pr-3 text-[var(--text-2)]">{a.cliente}</td>
                          <td className="py-2 pr-3 text-[var(--text-3)]">{[a.host, a.ip].filter(Boolean).join(" · ") || "—"}</td>
                          <td className="py-2">{a.activo ? <Pastilla verde>Activo</Pastilla> : <span className="text-[var(--text-3)]">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function ClienteCard({ c, dias }: { c: Cliente; dias: number }) {
  const maxDia = Math.max(0.0001, ...c.tokens.porDia.map((d) => d.costo));
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-[var(--text)]">
          {c.nombre}
          {c.oficial && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-brand">Cliente oficial</span>}
        </h2>
        <span className="text-[12px] text-[var(--text-3)]">
          {c.activosAhora > 0 ? `${c.activosAhora} ${c.activosAhora === 1 ? "persona" : "personas"} en el panel ahora` : "nadie en el panel ahora"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Tokens */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            <Bot size={12} /> Agente de IA · {dias} días
          </p>
          <p className="text-[24px] font-extrabold tracking-tight text-[var(--text)]">{dinero(c.tokens.costo)}</p>
          <p className="text-[12px] text-[var(--text-2)]">
            {miles(c.tokens.respuestas)} respuestas · {miles(c.tokens.tokensEntrada)} tokens de entrada · {miles(c.tokens.tokensSalida)} de salida
          </p>
          <p className="text-[11.5px] text-[var(--text-3)]">Desde el inicio: {dinero(c.tokens.costoTotalHistorico)}</p>
          {c.tokens.porDia.length > 0 && (
            <div className="mt-2 flex h-12 items-end gap-[2px]" title="Costo por día">
              {c.tokens.porDia.map((d) => (
                <div
                  key={d.dia}
                  title={`${d.dia}: ${dinero(d.costo)} · ${d.respuestas} respuestas`}
                  className="min-w-[3px] flex-1 rounded-t bg-brand/70"
                  style={{ height: `${Math.max(6, (d.costo / maxDia) * 100)}%` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Tickets */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            <TicketCheck size={12} /> Tickets
          </p>
          <p className="text-[24px] font-extrabold tracking-tight text-[var(--text)]">
            {c.tickets.abiertos} <span className="text-[13px] font-semibold text-[var(--text-3)]">abiertos</span>
          </p>
          <p className="text-[12px] text-[var(--text-2)]">
            {c.tickets.periodo} nuevos en {dias} días · {c.tickets.resueltos} resueltos · {c.tickets.porSofia} abiertos por la IA
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

        {/* Usuarios */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            <Users size={12} /> Personas con acceso
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

function Pastilla({ children, verde }: { children: React.ReactNode; verde?: boolean }) {
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", verde ? "bg-emerald-50 text-[#2f9e2f]" : "bg-surface text-[var(--text-3)]")}>
      {children}
    </span>
  );
}
