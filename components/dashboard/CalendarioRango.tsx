"use client";

// El calendario del filtro "Rango" del tablero de la agencia.
//
// Antes eran dos <input type="date">: al darle clic a "Rango" no se abría nada
// y había que atinarle al iconito de cada campo. Ahora el clic abre esto: un
// clic marca el primer día, otro el último, y se cierra solo.
//
// Las fechas van como "AAAA-MM-DD" (día de El Salvador), que ordenan bien como
// texto, así que se comparan sin pasar por Date.

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

const DOW = ["lu", "ma", "mi", "ju", "vi", "sá", "do"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const clave = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export function CalendarioRango({
  desde,
  hasta,
  max,
  onElegir,
  onCerrar,
}: {
  desde: string;
  hasta: string;
  /** El último día que se puede elegir (hoy). */
  max: string;
  onElegir: (desde: string, hasta: string) => void;
  onCerrar: () => void;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [mes, setMes] = useState(() => {
    const [y, m] = (hasta || max).split("-").map(Number);
    return { y, m: m - 1 };
  });
  // El primer clic: queda esperando el segundo.
  const [inicio, setInicio] = useState<string | null>(null);
  const [encima, setEncima] = useState<string | null>(null);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) onCerrar();
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [onCerrar]);

  const diasDelMes = new Date(Date.UTC(mes.y, mes.m + 1, 0)).getUTCDate();
  // Lunes primero: getUTCDay da 0 al domingo.
  const huecos = (new Date(Date.UTC(mes.y, mes.m, 1)).getUTCDay() + 6) % 7;
  const [maxY, maxM] = max.split("-").map(Number);
  const hayMesSiguiente = mes.y < maxY || (mes.y === maxY && mes.m < maxM - 1);

  // Lo que se pinta marcado: mientras se elige, del primer clic a donde está
  // el mouse; si no, el rango vigente.
  const [a, b] = inicio
    ? [inicio, encima ?? inicio].sort()
    : [desde, hasta];

  const mover = (paso: number) =>
    setMes(({ y, m }) => {
      const n = new Date(Date.UTC(y, m + paso, 1));
      return { y: n.getUTCFullYear(), m: n.getUTCMonth() };
    });

  const elegir = (dia: string) => {
    if (!inicio) {
      setInicio(dia);
      return;
    }
    const [x, y] = [inicio, dia].sort();
    onElegir(x, y);
    onCerrar();
  };

  return (
    <div
      ref={caja}
      className="absolute left-0 top-full z-30 mt-2 w-[280px] rounded-2xl border border-line bg-card p-3 shadow-lg"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => mover(-1)}
          aria-label="Mes anterior"
          className="rounded-lg p-1.5 text-[var(--text-2)] transition hover:bg-surface"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-[13px] font-bold capitalize text-[var(--text)]">
          {MESES[mes.m]} {mes.y}
        </p>
        <button
          type="button"
          onClick={() => mover(1)}
          disabled={!hayMesSiguiente}
          aria-label="Mes siguiente"
          className="rounded-lg p-1.5 text-[var(--text-2)] transition hover:bg-surface disabled:opacity-30"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {DOW.map((d) => (
          <p key={d} className="py-1 text-center text-[10.5px] font-bold uppercase text-[var(--text-3)]">
            {d}
          </p>
        ))}
        {Array.from({ length: huecos }).map((_, i) => (
          <span key={`h${i}`} />
        ))}
        {Array.from({ length: diasDelMes }).map((_, i) => {
          const dia = clave(mes.y, mes.m, i + 1);
          const futuro = dia > max;
          const punta = dia === a || dia === b;
          const adentro = dia > a && dia < b;
          return (
            <button
              key={dia}
              type="button"
              disabled={futuro}
              onClick={() => elegir(dia)}
              onMouseEnter={() => setEncima(dia)}
              className={cn(
                "h-8 rounded-lg text-[12.5px] font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-30",
                punta
                  ? "bg-brand text-white"
                  : adentro
                    ? "bg-brand/15 text-[var(--text)]"
                    : "text-[var(--text-2)] hover:bg-surface",
                dia === max && !punta && "ring-1 ring-inset ring-brand/50",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-center text-[11.5px] text-[var(--text-3)]">
        {inicio ? "Ahora el último día" : "Elige el primer día"}
      </p>
    </div>
  );
}
