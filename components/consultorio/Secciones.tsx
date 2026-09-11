"use client";

// Las secciones del escritorio del doctor.
//
// Son cuatro pantallas de la MISMA vista, no cuatro vistas: sus pacientes, lo
// que les ha recetado, lo que les ha mandado a hacer, y su código para
// compartir. Por eso van en pestañas acá adentro y no en el menú de la
// izquierda, que tiene las tres vistas del demo.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, FlaskConical, QrCode, Users } from "lucide-react";

const SECCIONES = [
  { href: "/consultorio", nombre: "Pacientes", Icono: Users },
  { href: "/consultorio/recetas", nombre: "Recetas", Icono: FileText },
  { href: "/consultorio/examenes", nombre: "Exámenes", Icono: FlaskConical },
  { href: "/consultorio/codigo", nombre: "Mi código", Icono: QrCode },
];

export function Secciones() {
  const ruta = usePathname();

  return (
    <div className="no-imprimir flex gap-1 border-b border-[var(--linea)] bg-[var(--panel)] px-6 pt-3">
      {SECCIONES.map(({ href, nombre, Icono }) => {
        // El expediente de un paciente cuelga de la lista, así que la pestaña
        // de Pacientes se queda marcada mientras se lee una ficha.
        const on =
          href === "/consultorio"
            ? ruta === "/consultorio" || ruta.startsWith("/consultorio/paciente")
            : ruta.startsWith(href);
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
