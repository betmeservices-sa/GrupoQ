"use client";

// El embudo de CrediQ: dónde está la gente y, sobre todo, dónde está la plata.
//
// Es un embudo de verdad y no una lista de barras: cada tramo es más angosto
// que el de arriba, así se ve de un vistazo por dónde se está cayendo el
// dinero. El ancho lo da la POSICIÓN, no la cantidad; si lo diera la cantidad,
// un tramo con más gente que el anterior rompería la forma y el gerente vería
// un acordeón en vez de un embudo.
//
// Al tocar un tramo, los leads salen a la izquierda: nombre, vendedor y cuánto
// quiere financiar cada uno. Ahí es donde la pantalla deja de ser un resumen y
// se vuelve una lista de a quién llamar.

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { EtapaId, LeadEnEtapa, ReporteVentas } from "@/lib/ventas-pipeline";

type Tramo = ReporteVentas["embudo"][number];

/** El de arriba ocupa todo; el de abajo, poco más de un tercio. */
const ANCHO_ARRIBA = 100;
const ANCHO_ABAJO = 38;

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** $28,700 no cabe en el tramo angosto; $29k sí. */
function usdCorto(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}k`;
  return usd(n);
}

function anchoEn(i: number, total: number): number {
  return ANCHO_ARRIBA - ((ANCHO_ARRIBA - ANCHO_ABAJO) * i) / total;
}

function Lead({ lead, vendedor, i }: { lead: LeadEnEtapa; vendedor: string; i: number }) {
  return (
    <li
      className="ccg-pop flex items-baseline justify-between gap-3 border-b border-line/60 py-2 last:border-0"
      style={{ animationDelay: `${Math.min(i, 12) * 22}ms` }}
    >
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-semibold text-[var(--text)]">{lead.nombre}</span>
        <span className="block truncate text-[11px] text-[var(--text-3)]">{vendedor}</span>
      </span>
      <span
        className={cn(
          "shrink-0 text-[12.5px] font-bold tabular-nums",
          lead.monto ? "text-[var(--text)]" : "text-[var(--text-3)]",
        )}
      >
        {lead.monto ? usd(lead.monto) : "sin monto"}
      </span>
    </li>
  );
}

export function Embudo({
  etapas,
  nombreVendedor,
}: {
  etapas: Tramo[];
  /** Cómo se llama el vendedor de un lead. Sale del equipo del cliente. */
  nombreVendedor: (id: string | null) => string;
}) {
  const [abierta, setAbierta] = useState<EtapaId | null>(null);
  const sel = etapas.find((e) => e.etapa === abierta) ?? null;
  const totalPlata = etapas.reduce((s, e) => s + e.monto, 0);
  const totalGente = etapas.reduce((s, e) => s + e.n, 0);
  const sinMonto = etapas.reduce((s, e) => s + e.leads.filter((l) => !l.monto).length, 0);

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Izquierda: quiénes son. Vacío hasta que se toca un tramo. */}
        <div className="order-2 lg:order-1">
          <div className="ccg-desplegar" data-abierto={sel ? "true" : "false"}>
            <div>
              {sel && (
                <div className="rounded-xl border border-line bg-surface/50 p-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: sel.color }} />
                    <h4 className="min-w-0 flex-1 truncate text-[13px] font-bold text-[var(--text)]">{sel.nombre}</h4>
                    <span className="shrink-0 text-[12.5px] font-bold tabular-nums text-[var(--text)]">
                      {usd(sel.monto)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-[var(--text-3)]">{sel.ayuda}</p>
                  {sel.leads.length > 0 ? (
                    <ul className="mt-2 max-h-[320px] overflow-y-auto pr-1">
                      {sel.leads.map((l, i) => (
                        <Lead key={l.telefono} lead={l} vendedor={nombreVendedor(l.vendedor)} i={i} />
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-[12px] text-[var(--text-2)]">Nadie en esta etapa.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {!sel && (
            <div className="flex h-full flex-col justify-center gap-3 rounded-xl border border-dashed border-line p-4">
              <div>
                <p className="text-[26px] font-black leading-none tracking-tight text-[var(--text)]">
                  {usd(totalPlata)}
                </p>
                <p className="mt-1 text-[12px] text-[var(--text-2)]">
                  en {totalGente} {totalGente === 1 ? "lead" : "leads"}
                  {sinMonto > 0 ? `, ${sinMonto} sin monto` : ""}
                </p>
              </div>
              <div className="space-y-1">
                {etapas
                  .filter((e) => e.n > 0)
                  .slice(0, 3)
                  .map((e) => (
                    <div key={e.etapa} className="flex items-center gap-2 text-[11.5px]">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: e.color }} />
                      <span className="min-w-0 flex-1 truncate text-[var(--text-2)]">{e.nombre}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-[var(--text)]">{usdCorto(e.monto)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Derecha: el embudo. */}
        <div className="order-1 lg:order-2">
          <div className="space-y-[3px]">
            {etapas.map((e, i) => {
              const arriba = anchoEn(i, etapas.length);
              const abajo = anchoEn(i + 1, etapas.length);
              const activa = abierta === e.etapa;
              return (
                <button
                  key={e.etapa}
                  type="button"
                  onClick={() => setAbierta(activa ? null : e.etapa)}
                  aria-pressed={activa}
                  className="group block w-full text-left transition-transform duration-200 hover:scale-[1.01]"
                >
                  <div
                    className={cn(
                      "flex h-[58px] items-center justify-center px-3 text-white transition-all duration-200",
                      activa ? "brightness-110 saturate-125" : "brightness-100 group-hover:brightness-105",
                    )}
                    style={{
                      background: e.color,
                      clipPath: `polygon(${(100 - arriba) / 2}% 0%, ${(100 + arriba) / 2}% 0%, ${(100 + abajo) / 2}% 100%, ${(100 - abajo) / 2}% 100%)`,
                      opacity: e.n === 0 ? 0.45 : 1,
                    }}
                  >
                    <div className="min-w-0 text-center leading-tight">
                      <p className="truncate text-[12px] font-bold">{e.nombre}</p>
                      <p className="truncate text-[11px] font-medium opacity-90 tabular-nums">
                        {e.n} {e.n === 1 ? "lead" : "leads"}
                        {e.monto > 0 ? ` · ${usdCorto(e.monto)}` : ""}
                      </p>
                    </div>
                    <ChevronRight
                      size={13}
                      className={cn(
                        "ml-1 shrink-0 transition-transform duration-200",
                        activa ? "rotate-90 opacity-100" : "opacity-0 group-hover:opacity-70",
                      )}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
            <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
              Total en el embudo
            </span>
            <span className="text-[15px] font-black tabular-nums text-[var(--text)]">{usd(totalPlata)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
