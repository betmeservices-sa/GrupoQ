"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SocialPost } from "@/lib/data/types";

export function PostComposer({
  onProgramar,
}: {
  onProgramar: (red: SocialPost["red"], texto: string, fecha: string) => void;
}) {
  const [red, setRed] = useState<SocialPost["red"]>("instagram");
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState("2026-06-26");
  const [hora, setHora] = useState("10:00");

  function programar() {
    const limpio = texto.trim();
    if (!limpio) return;
    onProgramar(red, limpio, `${fecha}T${hora}:00`);
    setTexto("");
  }

  return (
    <div className="w-full shrink-0 border-b border-line bg-card p-4 lg:w-80 lg:border-b-0 lg:border-r">
      <h2 className="mb-3 text-sm font-bold text-[#0f1b2d]">Nueva publicación</h2>

      <div className="mb-3 flex gap-2">
        {(["instagram", "facebook"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRed(r)}
            className={cn(
              "flex-1 rounded-lg border px-2 py-2 text-[12.5px] font-semibold capitalize transition",
              red === r
                ? "border-brand bg-brand/5 text-brand"
                : "border-line bg-surface text-[#5b6b80] hover:bg-surface-2",
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={5}
        placeholder="Escribe el contenido de la publicación..."
        className="mb-3 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-[13.5px] text-[#0f1b2d] outline-none transition placeholder:text-[#94a3b4] focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
      />

      <div className="mb-3 flex gap-2">
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-[12.5px] text-[#0f1b2d] outline-none focus:border-brand"
        />
        <input
          type="time"
          value={hora}
          onChange={(e) => setHora(e.target.value)}
          className="w-24 rounded-lg border border-line bg-surface px-2.5 py-2 text-[12.5px] text-[#0f1b2d] outline-none focus:border-brand"
        />
      </div>

      <button
        type="button"
        onClick={programar}
        disabled={!texto.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
      >
        <CalendarPlus size={17} />
        Programar publicación
      </button>
    </div>
  );
}
