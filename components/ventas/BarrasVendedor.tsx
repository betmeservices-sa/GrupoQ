"use client";

// Cuántos leads le tocaron a cada vendedor, y de dónde salieron.
//
// Es una barra por vendedor y no una tabla de ocho columnas: la pregunta del
// gerente acá es "¿a quién le estoy cargando la mano?", y eso se contesta
// comparando largos, no leyendo números en fila.
//
// Cada barra va partida por canal, porque la segunda pregunta llega sola: si
// un vendedor cierra el doble que otro, importa saber si le están entrando por
// Instagram o si son los que llegan solos a la sala. El canal lo marca el
// vendedor a mano en la ficha; lo que nadie marcó sale gris y aparte, nunca
// repartido a ojo.
//
// El filtro de periodo se resuelve en el navegador con los casos que ya están
// cargados: cambiar de "hoy" a "30 días" no vuelve a pegarle al servidor.

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { CANAL, porCanal, type Vendedor } from "@/lib/ventas-pipeline";
import type { Caso } from "./tipos";

const DIA = 86_400_000;

const RANGOS = [
  { id: "hoy", nombre: "Hoy", dias: 1 },
  { id: "7d", nombre: "7 días", dias: 7 },
  { id: "30d", nombre: "30 días", dias: 30 },
] as const;

type RangoId = (typeof RANGOS)[number]["id"];

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

const GRIS_SIN_MARCAR = "#cbd5e1";

interface Fila {
  id: string;
  nombre: string;
  casos: Caso[];
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
          casos: suyos,
          monto: suyos.reduce((s, c) => s + (c.monto ?? 0), 0),
        };
      })
      .sort((a, b) => b.casos.length - a.casos.length || b.monto - a.monto);
  }, [casos, vendedores, rango]);

  const tope = Math.max(1, ...filas.map((f) => f.casos.length));
  const totalLeads = filas.reduce((s, f) => s + f.casos.length, 0);
  const totalMonto = filas.reduce((s, f) => s + f.monto, 0);
  // La leyenda solo lista los canales que de verdad aparecen en el periodo.
  const leyenda = porCanal(filas.flatMap((f) => f.casos));

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

      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-[12px] text-[var(--text-3)]">
          {totalLeads} {totalLeads === 1 ? "lead" : "leads"}
          {totalMonto > 0 ? ` · ${usd(totalMonto)}` : ""}
        </span>
        {leyenda.map((c) => (
          <span key={c.nombre} className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-2)]">
            <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
            {c.nombre}
            <span className="font-semibold tabular-nums text-[var(--text)]">{c.n}</span>
          </span>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        {filas.map((f) => {
          const activo = abierto === f.id;
          const tramos = porCanal(f.casos);
          const suyos = f.casos.length;
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
                    {/* Un solo bloque de ancho proporcional al vendedor con más
                        leads, partido por dentro según el canal. */}
                    <span
                      className={cn(
                        "absolute inset-y-0 left-0 flex overflow-hidden rounded-lg transition-all duration-500 ease-out",
                        activo ? "brightness-110" : "group-hover:brightness-110",
                      )}
                      style={{ width: `${Math.max(4, (suyos / tope) * 100)}%` }}
                    >
                      {tramos.map((t) => (
                        <span
                          key={t.nombre}
                          title={`${t.nombre}: ${t.n}${t.monto > 0 ? ` · ${usd(t.monto)}` : ""}`}
                          className="h-full"
                          style={{ background: t.color, width: `${(t.n / suyos) * 100}%` }}
                        />
                      ))}
                    </span>
                    <span className="absolute inset-y-0 left-2 flex items-center text-[11.5px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.45)]">
                      {suyos}
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
                    {f.casos.length === 0 ? (
                      <li className="py-1.5 text-[12px] text-[var(--text-3)]">
                        No se le asignó ninguno en este periodo.
                      </li>
                    ) : (
                      f.casos.map((c, i) => (
                        <li
                          key={c.telefono}
                          className="ccg-pop flex items-center justify-between gap-3 border-b border-line/60 py-1.5 last:border-0"
                          style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ background: c.canal ? CANAL[c.canal].color : GRIS_SIN_MARCAR }}
                              title={c.canal ? CANAL[c.canal].nombre : "Sin marcar"}
                            />
                            <span className="truncate text-[12.5px] text-[var(--text)]">{c.nombre}</span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-[12px] font-bold tabular-nums",
                              c.monto ? "text-[var(--text)]" : "text-[var(--text-3)]",
                            )}
                          >
                            {c.monto ? usd(c.monto) : "sin monto"}
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
