"use client";

// Crear un canal y elegir quién está adentro.
//
// Solo lo ve quien puede administrar. Si el servidor rechaza la creación, se
// muestra el motivo en vez de dejar el formulario mudo: un botón que no hace
// nada y no explica por qué es peor que no tener el botón.

import { useState } from "react";
import { Plus } from "lucide-react";
import { staff } from "@/lib/data/seed";
import type { CanalInterno } from "@/lib/interno-store";

export function NuevoCanal({
  onCrear,
}: {
  onCrear: (canal: Partial<CanalInterno>) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [miembros, setMiembros] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Se esconde si el servidor dijo que este perfil no puede: preguntarlo una
  // vez y ocultarlo es mejor que ofrecerlo y rechazarlo cada vez.
  const [permitido, setPermitido] = useState(true);

  if (!permitido) return null;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await onCrear({ nombre, tipo: "canal", miembros });
    setEnviando(false);
    if (!r.ok) {
      setError(r.error ?? "No se pudo crear.");
      if (r.error?.includes("perfil")) setPermitido(false);
      return;
    }
    setNombre("");
    setMiembros([]);
    setAbierto(false);
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mx-2 mb-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-semibold text-[var(--text-3)] hover:bg-surface"
      >
        <Plus size={14} />
        Nuevo canal
      </button>
    );
  }

  return (
    <form onSubmit={crear} className="m-2 space-y-2 rounded-xl border border-line bg-surface/60 p-2.5">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del canal"
        className="w-full rounded-lg border border-line bg-card px-2.5 py-1.5 text-[13px]"
        required
        autoFocus
      />
      <div className="max-h-40 space-y-0.5 overflow-y-auto">
        {staff.map((s: { id: string; nombre: string }) => (
          <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-[12.5px]">
            <input
              type="checkbox"
              checked={miembros.includes(s.id)}
              onChange={(e) =>
                setMiembros((m) => (e.target.checked ? [...m, s.id] : m.filter((x) => x !== s.id)))
              }
              className="h-3.5 w-3.5 accent-[var(--brand)]"
            />
            <span className="truncate text-[var(--text-2)]">{s.nombre}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-1.5">
        <button
          type="submit"
          disabled={enviando}
          className="flex-1 rounded-lg bg-brand px-2.5 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-60"
        >
          {enviando ? "Creando" : "Crear"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg border border-line px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--text-2)]"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="text-[12px] text-[var(--bad-fg,#991b1b)]">{error}</p>}
    </form>
  );
}
