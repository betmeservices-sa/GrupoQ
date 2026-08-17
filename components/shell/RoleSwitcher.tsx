"use client";

import { UserCog } from "lucide-react";
import { ROLES, useRole } from "@/lib/roles";
import { Desplegable } from "@/components/ui/Desplegable";

// Control de demo: cambia el rol activo para mostrar qué ve cada perfil.
//
// Usa el desplegable propio y no un <select>: el menú de un select lo pinta el
// sistema operativo fuera de la página, y al compartir pantalla no se
// transmite. Justo este control es el que más se usa en una demostración en
// vivo, así que era el peor lugar para tener ese problema.
//
// Abre hacia ARRIBA porque vive al pie de la barra lateral.
export function RoleSwitcher() {
  const { rol, setRol } = useRole();

  return (
    <div className="rounded-xl border border-line bg-surface/60 p-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
        <UserCog size={13} />
        Ver como
      </p>
      <Desplegable
        valor={rol}
        onChange={(v) => setRol(v as typeof rol)}
        etiquetaAria="Ver la app como otro perfil"
        arriba
        opciones={Object.values(ROLES).map((r) => ({ valor: r.id, etiqueta: r.nombre }))}
      />
    </div>
  );
}
