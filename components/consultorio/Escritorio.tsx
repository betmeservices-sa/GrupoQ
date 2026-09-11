"use client";

// Con cuál escritorio de la clínica se está mirando: cuál de los dos doctores,
// o cuál de las dos sucursales.
//
// Existe porque es la mitad de lo que este módulo enseña: cada doctor tiene SU
// código y ve SOLO a los suyos, y cada sucursal lleva SU fila. Sin poder
// cambiar, eso hay que creerlo de palabra.

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

export interface Escritorio {
  id: string;
  nombre: string;
  detalle: string;
}

export function CambiarEscritorio({
  que,
  opciones,
  actual,
  volverA,
}: {
  que: "doctor" | "sucursal";
  opciones: Escritorio[];
  actual: string;
  volverA: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [abierto]);

  const puesto = opciones.find((o) => o.id === actual) ?? opciones[0];

  return (
    <div ref={caja} className="no-imprimir relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="flex items-center gap-2 rounded-[var(--r2)] border border-[var(--linea-2)] bg-[var(--panel)] px-3 py-2 text-left transition hover:border-[var(--texto-3)]"
      >
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] leading-tight text-[var(--texto)]">
            {puesto.nombre}
          </span>
          <span className="block truncate text-[11.5px] leading-tight text-[var(--texto-3)]">
            {puesto.detalle}
          </span>
        </span>
        <ChevronsUpDown size={15} className="shrink-0 text-[var(--texto-3)]" />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-[248px] overflow-hidden rounded-[var(--r)] border border-[var(--linea-2)] bg-[var(--panel)] shadow-[var(--sombra)]"
        >
          {opciones.map((o) => {
            const on = o.id === puesto.id;
            return (
              <a
                key={o.id}
                role="menuitem"
                href={`/api/consultorio/vista?que=${que}&id=${o.id}&a=${encodeURIComponent(volverA)}`}
                className={`flex items-center gap-2.5 px-3 py-2 transition ${
                  on ? "bg-[var(--verde-claro)]" : "hover:bg-[var(--panel-2)]"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] leading-tight text-[var(--texto)]">
                    {o.nombre}
                  </span>
                  <span className="block truncate text-[12px] text-[var(--texto-3)]">
                    {o.detalle}
                  </span>
                </span>
                {on && <Check size={15} className="shrink-0 text-[var(--verde-hondo)]" />}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
