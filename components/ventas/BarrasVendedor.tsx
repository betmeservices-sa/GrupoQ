"use client";

// Cuántos leads le tocaron a cada vendedor, y cuánta plata representan.
//
// Es una barra por vendedor y no una tabla de ocho columnas: la pregunta del
// gerente acá es "¿a quién le estoy cargando la mano?", y eso se contesta
// comparando largos, no leyendo números en fila.
//
// El filtro de periodo se resuelve en el navegador con los casos que ya están
// cargados: cambiar de "hoy" a "30 días" no vuelve a pegarle al servidor.

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Vendedor } from "@/lib/ventas-pipeline";
import type { Caso } from "./tipos";

const DIA = 86_400_000;

const RANGOS = [
  { id: "hoy", nombre: "Hoy", dias: 1 },
  { id: "7d", nombre: "7 días", dias: 7 },
  { id: "30d", nombre: "30 días", dias: 30 },
] as const;

type RangoId = (typeof RANGOS)[number]["id"];

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

interface Fila {
  id: string;
  nombre: string;
  iniciales: string;
  leads: { telefono: string; nombre: string; monto: number | null }[];
  monto: number;
}

export function BarrasVendedor({ casos, vendedores }: { casos: Caso[]; vendedores: Vendedor[] }) {
  const [rango, setRango] = useState<RangoId>("7d");
  const [abierto, setAbierto] = useState<string | null>(null);

  const filas = useMemo<Fila[]>(() => {
    const dias = RANGOS.find((x) => x.id === rango)?.dias ?? 7;
    // "Hoy" es el día corrido, no las últimas 24 horas: si el gerente mira a
    // las nueve de la mañana, lo de ayer a las once no es de hoy.
    const desde =
      dias === 1 ? new Date(new Date().setHours(0, 0, 0, 0)).getTime() : Date.now() - dias * DIA;
    return vendedores
      .map((v) => {
        const suyos = casos.filter(
          (c) => c.vendedor === v.id && c.asignado && Date.parse(c.asignado) >= desde,
        );
        return {
          id: v.id,
          nombre: v.nombre,
          iniciales: v.iniciales,
          leads: suyos.map((c) => ({ telefono: c.telefono, nombre: c.nombre, monto: c.monto ?? null })),
          monto: suyos.reduce((s, c) => s + (c.monto ?? 0), 0),
        };
      })
      .sort((a, b) => b.leads.length - a.leads.length || b.monto - a.monto);
  }, [casos, vendedores, rango]);

  const tope = Math.max(1, ...filas.map((f) => f.leads.length));
  const totalLeads = filas.reduce((s, f) => s + f.leads.length, 0);
  const totalMonto = filas.reduce((s, f) => s + f.monto, 0);

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-bold text-[var(--text)]">Leads asignados por vendedor</h3>
        <div className="flex rounded-lg border border-line p-0.5">
          {RANGOS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setRango(x.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition",
                rango === x.id
                  ? "bg-brand text-white shadow-sm"
                  : "text-[var(--text-3)] hover:bg-surface hover:text-[var(--text)]",
              )}
            >
              {x.nombre}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
        {totalLeads} {totalLeads === 1 ? "lead" : "leads"}
        {totalMonto > 0 ? ` · ${usd(totalMonto)}` : ""}
      </p>

      <div className="mt-3 space-y-2">
        {filas.map((f) => {
          const activo = abierto === f.id;
          return (
            <div key={f.id}>
              <button
                type="button"
                onClick={() => setAbierto(activo ? null : f.id)}
                aria-pressed={activo}
                className="group w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-[34%] min-w-0 shrink-0 truncate text-[12.5px] font-semibold text-[var(--text)]">
                    {f.nombre}
                  </span>
                  <span className="relative h-7 flex-1 overflow-hidden rounded-lg bg-surface">
                    <span
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-lg bg-brand transition-all duration-500 ease-out",
                        activo ? "brightness-110" : "group-hover:brightness-110",
                      )}
                      style={{ width: `${Math.max(4, (f.leads.length / tope) * 100)}%` }}
                    />
                    <span className="absolute inset-y-0 left-2 flex items-center text-[11.5px] font-bold text-white mix-blend-luminosity">
                      {f.leads.length}
                    </span>
                  </span>
                  <span className="w-[74px] shrink-0 text-right text-[12px] font-semibold tabular-nums text-[var(--text-2)]">
                    {f.monto > 0 ? usd(f.monto) : "·"}
                  </span>
                  <ChevronRight
                    size={14}
                    className={cn(
                      "shrink-0 text-[var(--text-3)] transition-transform duration-200",
                      activo && "rotate-90",
                    )}
                  />
                </div>
              </button>

              <div className="ccg-desplegar" data-abierto={activo ? "true" : "false"}>
                <div>
                  <ul className="mt-1.5 ml-[34%] rounded-xl border border-line bg-surface/50 px-3 py-1.5">
                    {f.leads.length === 0 ? (
                      <li className="py-1.5 text-[12px] text-[var(--text-3)]">
                        No se le asignó ninguno en este periodo.
                      </li>
                    ) : (
                      f.leads.map((l, i) => (
                        <li
                          key={l.telefono}
                          className="ccg-pop flex items-baseline justify-between gap-3 border-b border-line/60 py-1.5 last:border-0"
                          style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}
                        >
                          <span className="min-w-0 truncate text-[12.5px] text-[var(--text)]">{l.nombre}</span>
                          <span
                            className={cn(
                              "shrink-0 text-[12px] font-bold tabular-nums",
                              l.monto ? "text-[var(--text)]" : "text-[var(--text-3)]",
                            )}
                          >
                            {l.monto ? usd(l.monto) : "sin monto"}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
