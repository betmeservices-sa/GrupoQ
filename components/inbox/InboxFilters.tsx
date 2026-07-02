"use client";

import { cn } from "@/lib/cn";
import { departments } from "@/lib/data/seed";
import type { Channel, ConversationStatus, DepartmentId } from "@/lib/data/types";

export type CanalFiltro = "todos" | Exclude<Channel, "internal">;
export type EstadoFiltro = "todos" | ConversationStatus;
export type AsignacionFiltro = "todas" | "mias" | "sin_asignar";
export type DeptFiltro = "todos" | DepartmentId;

export interface Filtros {
  canal: CanalFiltro;
  estado: EstadoFiltro;
  asignacion: AsignacionFiltro;
  departamento: DeptFiltro;
}

const CANALES: { id: CanalFiltro; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
];

const ESTADOS: { id: EstadoFiltro; label: string }[] = [
  { id: "todos", label: "Estado" },
  { id: "nuevo", label: "Nuevo" },
  { id: "en_progreso", label: "En progreso" },
  { id: "resuelto", label: "Resuelto" },
];

const ASIGNACIONES: { id: AsignacionFiltro; label: string }[] = [
  { id: "todas", label: "Asignación" },
  { id: "mias", label: "Mías" },
  { id: "sin_asignar", label: "Sin asignar" },
];

export function InboxFilters({
  filtros,
  onChange,
}: {
  filtros: Filtros;
  onChange: (next: Filtros) => void;
}) {
  return (
    <div className="space-y-2.5 border-b border-line px-3.5 py-3">
      <div className="flex gap-1.5">
        {CANALES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange({ ...filtros, canal: c.id })}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition",
              filtros.canal === c.id
                ? "bg-brand text-white"
                : "bg-surface text-[#5b6b80] hover:bg-surface-2",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Select
          value={filtros.estado}
          onChange={(v) => onChange({ ...filtros, estado: v as EstadoFiltro })}
          options={ESTADOS}
        />
        <Select
          value={filtros.asignacion}
          onChange={(v) => onChange({ ...filtros, asignacion: v as AsignacionFiltro })}
          options={ASIGNACIONES}
        />
        <Select
          value={filtros.departamento}
          onChange={(v) => onChange({ ...filtros, departamento: v as DeptFiltro })}
          options={[
            { id: "todos", label: "Departamento" },
            ...departments.map((d) => ({ id: d.id, label: d.nombre })),
          ]}
        />
      </div>
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="cursor-pointer rounded-lg border border-line bg-surface px-2 py-1.5 text-[12.5px] font-medium text-[#5b6b80] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
    >
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
