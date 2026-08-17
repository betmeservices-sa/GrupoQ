"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, PhoneOff, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";
import { cuandoVence, dinero, dineroCorto, fechaCorta, telefonoSv } from "@/lib/cobros-formato";
import {
  ESTADO_NOMBRE,
  PRODUCTO_NOMBRE,
  TRAMO_NOMBRE,
  type DeudorVista,
  type EstadoGestion,
  type ProductoCredito,
  type ResumenCartera,
  type TramoMora,
} from "@/lib/cobros-tipos";
import { EstadoPill, TramoPill } from "@/components/cobros/Pills";

const TRAMOS: TramoMora[] = ["1_30", "31_60", "61_90", "90_mas"];

const CAMPO =
  "rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-[var(--text)] outline-none transition focus:border-brand";

interface Respuesta {
  ok: boolean;
  hoy: string;
  resumen: ResumenCartera;
  total: number;
  deudores: DeudorVista[];
}

function Kpi({
  label,
  valor,
  pie,
  alerta,
}: {
  label: string;
  valor: string;
  pie?: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <p className="text-[12px] font-semibold text-[var(--text-3)]">{label}</p>
      <p
        className={cn(
          "mt-2 text-[26px] font-extrabold leading-none tracking-tight",
          alerta ? "text-[var(--brand-red)]" : "text-[var(--text)]",
        )}
      >
        {valor}
      </p>
      {pie && <p className="mt-1.5 text-[12px] text-[var(--text-3)]">{pie}</p>}
    </div>
  );
}

// La distribución por tramo es LA foto de una cartera: dice si el problema es
// de gente que se atrasó este mes o de deuda que ya lleva medio año.
function BarraTramos({ resumen }: { resumen: ResumenCartera }) {
  const total = TRAMOS.reduce((s, t) => s + resumen.porTramo[t].monto, 0) || 1;
  const COLOR: Record<TramoMora, string> = {
    al_dia: "#69be28",
    "1_30": "#549820",
    "31_60": "#00693c",
    "61_90": "#8a5300",
    "90_mas": "#b3261e",
  };
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      <p className="text-[12px] font-semibold text-[var(--text-3)]">Mora por tramo</p>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
        {TRAMOS.map((t) => {
          const pct = (resumen.porTramo[t].monto / total) * 100;
          if (pct <= 0) return null;
          return (
            <div key={t} style={{ width: `${pct}%`, background: COLOR[t] }} title={TRAMO_NOMBRE[t]} />
          );
        })}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        {TRAMOS.map((t) => (
          <div key={t} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR[t] }} />
              <span className="truncate text-[11.5px] font-medium text-[var(--text-2)]">
                {TRAMO_NOMBRE[t]}
              </span>
            </div>
            <p className="mt-0.5 pl-3.5 text-[13px] font-bold text-[var(--text)]">
              {dineroCorto(resumen.porTramo[t].monto)}
              <span className="ml-1 text-[11px] font-medium text-[var(--text-3)]">
                {resumen.porTramo[t].cuentas}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CobrosPage() {
  const router = useRouter();
  const esPromerica = activeTenantId() === "promerica";
  useEffect(() => {
    if (!esPromerica) router.replace("/");
  }, [esPromerica, router]);

  const [data, setData] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [texto, setTexto] = useState("");
  const [tramo, setTramo] = useState<TramoMora | "todos">("todos");
  const [estado, setEstado] = useState<EstadoGestion | "todos">("todos");
  const [producto, setProducto] = useState<ProductoCredito | "todos">("todos");
  const [vencidas, setVencidas] = useState(false);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (texto.trim()) p.set("q", texto.trim());
    if (tramo !== "todos") p.set("tramo", tramo);
    if (estado !== "todos") p.set("estado", estado);
    if (producto !== "todos") p.set("producto", producto);
    if (vencidas) p.set("vencidas", "1");
    p.set("limite", "150");
    return p.toString();
  }, [texto, tramo, estado, producto, vencidas]);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch(`/api/cobros/cartera?${query}`, { cache: "no-store" });
      const d = (await r.json()) as Respuesta & { error?: string };
      if (d.ok) {
        setData(d);
        setError(null);
      } else {
        setError(d.error ?? "No se pudo leer la cartera.");
      }
    } catch {
      setError("No se pudo leer la cartera.");
    }
    setCargando(false);
  }, [query]);

  useEffect(() => {
    if (!esPromerica) return;
    // Espera a que el usuario deje de escribir antes de volver a pedir.
    const t = setTimeout(() => void cargar(), 220);
    return () => clearTimeout(t);
  }, [cargar, esPromerica]);

  if (!esPromerica) return <div className="flex-1 bg-surface" />;

  const r = data?.resumen;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-4 py-3 sm:px-5">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Cartera de mora</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            {r
              ? `${r.cuentas.toLocaleString("en-US")} cuentas · ${dinero(r.montoVencido)} vencidos de ${dineroCorto(r.saldoTotal)} en saldo`
              : "Cargando la cartera"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void cargar()}
            disabled={cargando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-60"
          >
            <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          <Link
            href="/campanas"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-[13px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110"
          >
            Llamar a esta cartera
          </Link>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {error && (
          <div className="rounded-xl border border-[#f2c9c6] bg-[#fceceb] p-3 text-xs text-[#b3261e]">
            {error}
          </div>
        )}

        {r && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                label="Vencido total"
                valor={dineroCorto(r.montoVencido)}
                pie={`${r.cuentas.toLocaleString("en-US")} cuentas en gestión`}
              />
              <Kpi
                label="Prometido vigente"
                valor={dineroCorto(r.montoPrometido)}
                pie={`${r.promesasVigentes} promesas por vencer`}
              />
              <Kpi
                label="Recuperado del mes"
                valor={dineroCorto(r.recuperadoMes)}
                pie={`${r.contactadosHoy} contactos efectivos hoy`}
              />
              <Kpi
                label="Promesas incumplidas"
                valor={String(r.promesasVencidas)}
                pie="Se caen si nadie las toca"
                alerta={r.promesasVencidas > 0}
              />
            </div>

            <BarraTramos resumen={r} />
          </>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
            />
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Buscar por nombre, documento, cuenta o teléfono"
              className={cn(CAMPO, "w-full pl-9")}
            />
          </div>
          <select value={tramo} onChange={(e) => setTramo(e.target.value as TramoMora | "todos")} className={CAMPO}>
            <option value="todos">Todos los tramos</option>
            {TRAMOS.map((t) => (
              <option key={t} value={t}>
                {TRAMO_NOMBRE[t]}
              </option>
            ))}
          </select>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value as EstadoGestion | "todos")}
            className={CAMPO}
          >
            <option value="todos">Todos los estados</option>
            {(Object.keys(ESTADO_NOMBRE) as EstadoGestion[]).map((e) => (
              <option key={e} value={e}>
                {ESTADO_NOMBRE[e]}
              </option>
            ))}
          </select>
          <select
            value={producto}
            onChange={(e) => setProducto(e.target.value as ProductoCredito | "todos")}
            className={CAMPO}
          >
            <option value="todos">Todos los productos</option>
            {(Object.keys(PRODUCTO_NOMBRE) as ProductoCredito[]).map((p) => (
              <option key={p} value={p}>
                {PRODUCTO_NOMBRE[p]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setVencidas((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition",
              vencidas
                ? "border-[var(--brand-red)] bg-[#fceceb] text-[#b3261e]"
                : "border-line bg-card text-[var(--text-2)] hover:bg-surface",
            )}
          >
            <AlertTriangle size={14} />
            Promesa incumplida
          </button>
          {data && (
            <span className="text-[12px] text-[var(--text-3)]">
              {data.deudores.length} de {data.total.toLocaleString("en-US")}
            </span>
          )}
        </div>

        {/* Tabla */}
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead>
                <tr className="border-b border-line bg-surface text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                  <th className="px-4 py-2.5 font-bold">Cliente</th>
                  <th className="px-4 py-2.5 font-bold">Producto</th>
                  <th className="px-4 py-2.5 text-right font-bold">Vencido</th>
                  <th className="px-4 py-2.5 font-bold">Mora</th>
                  <th className="px-4 py-2.5 font-bold">Estado</th>
                  <th className="px-4 py-2.5 font-bold">Promesa</th>
                  <th className="px-4 py-2.5 font-bold">Lo último</th>
                </tr>
              </thead>
              <tbody>
                {(data?.deudores ?? []).map((d) => (
                  <tr
                    key={d.id}
                    className="group border-b border-line/70 last:border-0 hover:bg-surface"
                  >
                    <td className="px-4 py-2.5 align-top">
                      <Link href={`/cobros/${d.id}`} className="block">
                        <span className="flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--text)] group-hover:text-brand">
                          {d.nombre}
                          {!d.llamable && (
                            <PhoneOff size={12} className="text-[var(--text-3)]" aria-label="No llamable" />
                          )}
                        </span>
                        <span className="text-[11.5px] text-[var(--text-3)]">
                          {telefonoSv(d.telefono)}
                          {d.documento ? ` · ${d.documento}` : ""}
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <p className="text-[12.5px] font-medium text-[var(--text-2)]">
                        {PRODUCTO_NOMBRE[d.producto]}
                      </p>
                      <p className="text-[11.5px] text-[var(--text-3)]">{d.cuenta}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right align-top">
                      <p className="text-[13.5px] font-extrabold text-[var(--text)]">
                        {dinero(d.montoVencido)}
                      </p>
                      <p className="text-[11.5px] text-[var(--text-3)]">
                        de {dineroCorto(d.saldoTotal)}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <TramoPill tramo={d.tramo} dias={d.diasMora} />
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <EstadoPill estado={d.estado} />
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      {d.promesa ? (
                        <>
                          <p className="text-[12.5px] font-bold text-[var(--text)]">
                            {dinero(d.promesa.monto)}
                          </p>
                          <p
                            className={cn(
                              "text-[11.5px]",
                              d.promesaVencida
                                ? "font-bold text-[var(--brand-red)]"
                                : "text-[var(--text-3)]",
                            )}
                          >
                            {fechaCorta(d.promesa.fecha)} · {cuandoVence(d.diasParaPromesa)}
                          </p>
                        </>
                      ) : (
                        <span className="text-[12px] text-[var(--text-3)]">Sin promesa</span>
                      )}
                    </td>
                    <td className="max-w-[280px] px-4 py-2.5 align-top">
                      <p className="line-clamp-2 text-[12px] text-[var(--text-2)]">
                        {d.resumenIa ?? d.ultimaLlamada?.resumen ?? "Sin gestión todavía."}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--text-3)]">
                        {d.intentos > 0 ? `${d.intentos} intento${d.intentos === 1 ? "" : "s"}` : ""}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!cargando && (data?.deudores.length ?? 0) === 0 && (
            <p className="px-4 py-10 text-center text-[13px] text-[var(--text-3)]">
              Ninguna cuenta calza con esos filtros.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
