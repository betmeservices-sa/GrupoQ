"use client";

// Las dos salas del mismo departamento: imagenología y procedimientos.
//
// Comparten mostrador porque comparten personal y pasillo, pero cada una lleva
// SU fila y SU código de entrada: quien llega por una radiografía no está en la
// misma cola que quien viene a que le quiten unos puntos.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Scan, Stethoscope } from "lucide-react";

const SALAS = [
  { href: "/imagenologia", nombre: "Imagenología", Icono: Scan },
  { href: "/imagenologia/procesos", nombre: "Procesos", Icono: Stethoscope },
];

export function PestanasUnidad() {
  const ruta = usePathname();
  return (
    <div className="no-imprimir flex gap-1 border-b border-[var(--linea)] bg-[var(--panel)] px-6 pt-3">
      {SALAS.map(({ href, nombre, Icono }) => {
        const on = href === "/imagenologia" ? ruta === "/imagenologia" : ruta.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[14px] transition ${
              on
                ? "border-[var(--verde)] font-semibold text-[var(--texto)]"
                : "border-transparent text-[var(--texto-2)] hover:text-[var(--texto)]"
            }`}
          >
            <Icono size={16} strokeWidth={on ? 2.3 : 1.9} />
            {nombre}
          </Link>
        );
      })}
    </div>
  );
}
