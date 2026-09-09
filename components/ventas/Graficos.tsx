"use client";

import { useState } from "react";
// Tipos propios, chicos y sin dependencias: estos graficos sirven a cualquier
// pantalla que le pase numeros, no a una fuente de datos en particular.
export interface PasoEmbudo {
  etapa: string;
  cantidad: number;
}
export interface Rebanada {
  nombre: string;
  color: string;
  valor: number;
}

// Los gráficos del resumen de CrediQ, en SVG a mano.
//
// Sin librería de gráficos a propósito: son formas simples, y una librería
// traería su propio sistema de color y de tipografía peleando con el del panel.
//
// NOTA DE COLOR. La paleta de la dona se validó con el script de la guía en los
// dos modos: entra en la banda de luminosidad, pasa el piso de contraste y el de
// visión normal. La separación para daltonismo queda en 7.9 (banda 6-8), que
// SOLO es legal con codificación secundaria: por eso cada gajo lleva su etiqueta
// con nombre y número, y van separados por un hueco. El color no es el único
// canal que dice cuál es cuál. Si algún día se agrega una quinta categoría hay
// que volver a correr el validador, no elegir un tono a ojo.

const fmt = (n: number) => n.toLocaleString("es-SV");

// --- Embudo ---
// Un solo tono, de claro a oscuro conforme se avanza. Es una sola magnitud a lo
// largo de un proceso ordenado, no categorías: por eso rampa y no paleta.
// Va de medio a oscuro, no de claro a oscuro: sobre la tarjeta blanca los
// azules claros se pierden. Medido contra #ffffff, los tres primeros tonos de
// la rampa anterior daban 1.8:1, 2.2:1 y 2.5:1, debajo del 3:1 que pide WCAG
// para un objeto grafico. Estos siete arrancan en 3.7:1 y llegan a 12.8:1.
const RAMPA = [
  "#3B82F6",
  "#2E6FE0",
  "#2563EB",
  "#1D4ED8",
  "#1E40AF",
  "#1E3A8A",
  "#172E6B",
];

export function Embudo({
  pasos,
  seleccion,
  onSeleccion,
}: {
  pasos: PasoEmbudo[];
  seleccion: string | null;
  onSeleccion: (etapa: string) => void;
}) {
  const tope = Math.max(1, ...pasos.map((p) => p.cantidad));
  return (
    <div className="flex flex-col gap-1.5">
      {pasos.map((p, i) => {
        const activo = seleccion === p.etapa;
        // El ancho sale del máximo, no del total: con un embudo muy desigual
        // los tramos chicos quedarían invisibles.
        const ancho = p.cantidad === 0 ? 0 : Math.max(6, (p.cantidad / tope) * 100);
        return (
          <button
            key={p.etapa}
            type="button"
            onClick={() => onSeleccion(p.etapa)}
            aria-pressed={activo}
            className={`group flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition ${
              activo ? "bg-surface" : "hover:bg-surface/60"
            }`}
          >
            <span className="w-40 shrink-0 truncate text-[11.5px] font-semibold text-[var(--text-2)]">
              {p.etapa}
            </span>
            <span className="relative h-6 flex-1 overflow-hidden rounded">
              <span
                className="absolute inset-y-0 left-0 rounded transition-all"
                style={{
                  width: `${ancho}%`,
                  backgroundColor: RAMPA[Math.min(i, RAMPA.length - 1)],
                  opacity: activo || seleccion === null ? 1 : 0.45,
                }}
              />
            </span>
            <span className="w-16 shrink-0 text-right text-[13px] font-extrabold text-[var(--text)]">
              {fmt(p.cantidad)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// --- Dona ---
export function Dona({ datos }: { datos: Rebanada[] }) {
  const [encima, setEncima] = useState<number | null>(null);
  const total = datos.reduce((s, d) => s + d.valor, 0);
  if (total === 0) {
    return <p className="text-xs text-[var(--text-3)]">Sin datos todavía.</p>;
  }

  const R = 54;
  const C = 2 * Math.PI * R;
  const HUECO = 3; // los 2px de separación que pide la guía, con margen

  let acumulado = 0;
  const arcos = datos.map((d, i) => {
    const largo = (d.valor / total) * C;
    const arco = {
      ...d,
      i,
      largo: Math.max(0, largo - HUECO),
      offset: -acumulado,
    };
    acumulado += largo;
    return arco;
  });

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg viewBox="0 0 140 140" className="h-[140px] w-[140px] shrink-0" role="img">
        <g transform="translate(70,70) rotate(-90)">
          {arcos.map((a) => (
            <circle
              key={a.nombre}
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth={encima === a.i ? 24 : 20}
              strokeDasharray={`${a.largo} ${C - a.largo}`}
              strokeDashoffset={a.offset}
              onMouseEnter={() => setEncima(a.i)}
              onMouseLeave={() => setEncima(null)}
              className="cursor-default transition-[stroke-width]"
            />
          ))}
        </g>
        <text
          x="70"
          y="66"
          textAnchor="middle"
          className="fill-[var(--text)] text-[20px] font-extrabold"
        >
          {fmt(encima === null ? total : datos[encima].valor)}
        </text>
        <text
          x="70"
          y="82"
          textAnchor="middle"
          className="fill-[var(--text-3)] text-[9px]"
        >
          {encima === null ? "en total" : datos[encima].nombre}
        </text>
      </svg>

      {/* Cada fila nombra su gajo: el color no es el único canal. */}
      <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
        {datos.map((d, i) => (
          <li
            key={d.nombre}
            onMouseEnter={() => setEncima(i)}
            onMouseLeave={() => setEncima(null)}
            className="flex items-center gap-2 text-[12px]"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: d.color }}
            />
            <span className="min-w-0 flex-1 truncate text-[var(--text-2)]">{d.nombre}</span>
            <span className="shrink-0 font-bold text-[var(--text)]">{fmt(d.valor)}</span>
            <span className="w-10 shrink-0 text-right text-[var(--text-3)]">
              {Math.round((d.valor / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
