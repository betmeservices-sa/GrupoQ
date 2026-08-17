"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

// Desplegable dibujado DENTRO de la página, no un <select> nativo.
//
// El motivo no es estético: el menú de un <select> lo pinta el sistema
// operativo, en una ventana aparte de la página. Al compartir pantalla en una
// demo, esa ventana no se transmite: el cliente ve el clic y después nada. Un
// menú hecho con divs sí se ve, y de paso se puede pintar con la marca del
// tenant.
//
// Teclado: flechas para moverse, Enter para elegir, Escape para cerrar, y el
// foco vuelve al botón al cerrar.

export interface OpcionDesplegable {
  valor: string;
  etiqueta: string;
  // Segunda línea opcional, para cuando la etiqueta sola no alcanza.
  detalle?: string;
}

export function Desplegable({
  valor,
  opciones,
  onChange,
  etiquetaAria,
  arriba = false,
  className,
}: {
  valor: string;
  opciones: OpcionDesplegable[];
  onChange: (valor: string) => void;
  etiquetaAria: string;
  // El menú abre hacia arriba cuando el control vive al pie de la pantalla.
  arriba?: boolean;
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idLista = useId();

  const actual = opciones.find((o) => o.valor === valor);

  // Al abrir, el resaltado arranca en la opción vigente.
  useEffect(() => {
    if (abierto) {
      const i = opciones.findIndex((o) => o.valor === valor);
      setMarcado(i >= 0 ? i : 0);
    }
  }, [abierto, opciones, valor]);

  // Cerrar al hacer clic fuera o al perder el foco hacia otra parte.
  useEffect(() => {
    if (!abierto) return;
    function fuera(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  function elegir(v: string) {
    onChange(v);
    setAbierto(false);
    boton.current?.focus();
  }

  function teclas(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setAbierto(false);
      boton.current?.focus();
      return;
    }
    if (!abierto) {
      if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setAbierto(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMarcado((i) => (i + 1) % opciones.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarcado((i) => (i - 1 + opciones.length) % opciones.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      elegir(opciones[marcado].valor);
    }
  }

  return (
    <div ref={contenedor} className={cn("relative", className)} onKeyDown={teclas}>
      <button
        ref={boton}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-label={etiquetaAria}
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-line bg-card px-2.5 py-2 text-left text-sm font-medium text-[var(--text)] outline-none transition hover:border-[var(--border-2)] focus:border-brand focus:ring-2 focus:ring-brand/15"
      >
        <span className="truncate">{actual?.etiqueta ?? "Elegir"}</span>
        <ChevronDown
          size={15}
          className={cn("shrink-0 text-[var(--text-3)] transition", abierto && "rotate-180")}
        />
      </button>

      {abierto && (
        <ul
          id={idLista}
          role="listbox"
          aria-label={etiquetaAria}
          className={cn(
            "absolute z-50 max-h-64 w-full overflow-y-auto rounded-xl border border-line bg-card p-1 shadow-lg",
            arriba ? "bottom-full mb-1.5" : "top-full mt-1.5",
          )}
        >
          {opciones.map((o, i) => {
            const elegido = o.valor === valor;
            return (
              <li key={o.valor}>
                <button
                  type="button"
                  role="option"
                  aria-selected={elegido}
                  onMouseEnter={() => setMarcado(i)}
                  onClick={() => elegir(o.valor)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition",
                    i === marcado ? "bg-surface" : "bg-transparent",
                    elegido ? "font-bold text-brand" : "font-medium text-[var(--text-2)]",
                  )}
                >
                  <Check
                    size={14}
                    className={cn("mt-0.5 shrink-0", elegido ? "opacity-100" : "opacity-0")}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{o.etiqueta}</span>
                    {o.detalle && (
                      <span className="block truncate text-[11.5px] font-medium text-[var(--text-3)]">
                        {o.detalle}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
