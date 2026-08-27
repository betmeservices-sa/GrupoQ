"use client";

// Por cuál página se mira la bandeja (o los comentarios).
//
// Con una sola página no hacía falta. Con cuatro (Yalí, Sunzal, Costa del
// Surf, Playa Linda), cada una con su Facebook y su Instagram, quien atiende
// necesita ver una marca a la vez: "Todas" arriba, y de ahí los filtros de
// siempre (canal, estado, asignación).

import { cn } from "@/lib/cn";

export interface PaginaOpcion {
  id: string;
  nombre: string;
}

/** "YALI Hotel & Resort" → "YALI Hotel": que quepan cuatro en una fila. */
export function nombreCortoDePagina(nombre: string): string {
  return nombre.replace(/\s*&\s*Resort$/i, "").replace(/\s+Beach Club$/i, "").trim();
}

export function PaginaToggle({
  paginas,
  valor,
  onChange,
  className,
}: {
  paginas: PaginaOpcion[];
  valor: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  if (paginas.length < 2) return null;
  const opciones = [{ id: "todas", nombre: "Todas" }, ...paginas];
  return (
    <div className={cn("flex flex-wrap gap-1", className)} role="tablist" aria-label="Página">
      {opciones.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={valor === p.id}
          onClick={() => onChange(p.id)}
          title={p.nombre}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[12px] font-semibold transition",
            valor === p.id
              ? "border-brand bg-brand text-white"
              : "border-line bg-card text-[var(--text-2)] hover:border-brand/40 hover:text-[var(--text)]",
          )}
        >
          {p.id === "todas" ? p.nombre : nombreCortoDePagina(p.nombre)}
        </button>
      ))}
    </div>
  );
}
