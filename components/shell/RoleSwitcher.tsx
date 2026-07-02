"use client";

import { UserCog } from "lucide-react";
import { ROLES, useRole } from "@/lib/roles";
import type { RoleId } from "@/lib/data/types";

// Control de demo: cambia el rol activo para mostrar qué ve cada perfil.
export function RoleSwitcher() {
  const { rol, setRol } = useRole();
  return (
    <div className="rounded-xl border border-line bg-surface/60 p-3">
      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b4]">
        <UserCog size={13} />
        Ver como
      </label>
      <select
        value={rol}
        onChange={(e) => setRol(e.target.value as RoleId)}
        className="w-full cursor-pointer rounded-lg border border-line bg-white px-2.5 py-2 text-sm font-medium text-[#0f1b2d] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
      >
        {Object.values(ROLES).map((r) => (
          <option key={r.id} value={r.id}>
            {r.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}
