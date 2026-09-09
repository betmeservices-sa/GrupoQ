"use client";

// Antes de lanzar una tanda de llamadas: con qué guion y confirmar.
//
// POR QUÉ NO ES UN `confirm()` DEL NAVEGADOR. El de antes solo preguntaba
// "¿seguimos?" y el guion salía siempre el mismo. Pero un CSV de gente que
// nunca nos ha hablado y uno de gente que ya dejó su solicitud a medias no se
// llaman igual: al segundo, presentarle la empresa y preguntarle si le interesa
// un crédito suena a que perdimos su expediente.
//
// Y porque un `confirm()` no puede mostrar a cuántas personas se le va a marcar
// ni qué le va a decir el agente, que es exactamente lo que hay que mirar antes
// de gastar plata en llamadas que no se pueden deshacer.

import { useEffect, useState } from "react";
import { PhoneCall, RotateCcw, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type OrigenTanda = "primer_contacto" | "reactivacion";

const OPCIONES: {
  id: OrigenTanda;
  nombre: string;
  Icon: typeof Sparkles;
  quien: string;
  dice: string;
}[] = [
  {
    id: "primer_contacto",
    nombre: "Primer contacto",
    Icon: Sparkles,
    quien: "Gente que dejó sus datos y todavía no ha hablado con nadie.",
    dice: "Se presenta, pregunta qué vehículo busca y de cuánto lo anda pensando, y le pasa los requisitos.",
  },
  {
    id: "reactivacion",
    nombre: "Reactivación de crédito",
    Icon: RotateCcw,
    quien: "Gente que ya empezó su solicitud con nosotros y la dejó a medias.",
    dice: "Retoma la solicitud que ya existe, pregunta si todavía le interesa y qué lo dejó parado. No vuelve a presentar la empresa.",
  },
];

export function ConfirmarTanda({
  cuantos,
  onCancelar,
  onConfirmar,
}: {
  cuantos: number;
  onCancelar: () => void;
  onConfirmar: (origen: OrigenTanda) => void;
}) {
  // Sin opción marcada de entrada: elegir el guion es la decisión de esta
  // pantalla, y dejar una preseleccionada invita a darle a Llamar sin leerla.
  const [origen, setOrigen] = useState<OrigenTanda | null>(null);
  const [lanzando, setLanzando] = useState(false);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCancelar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCancelar}
      role="presentation"
    >
      <div
        className="my-auto w-full max-w-[520px] overflow-hidden rounded-2xl border border-line bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-tanda"
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <PhoneCall size={16} className="shrink-0 text-brand" />
          <h2 id="titulo-tanda" className="text-[14px] font-bold text-[var(--text)]">
            {cuantos} llamada{cuantos === 1 ? "" : "s"} de verdad
          </h2>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Cerrar"
            className="ml-auto rounded-lg p-1 text-[var(--text-3)] transition hover:bg-surface hover:text-[var(--text)]"
          >
            <X size={16} />
          </button>
        </header>

        <div className="px-4 py-3">
          <p className="text-[12.5px] text-[var(--text-2)]">
            Salen de a una y espaciadas, y cuestan. ¿Con cuál guion las hacemos?
          </p>

          <div className="mt-3 space-y-2">
            {OPCIONES.map((o) => {
              const activo = origen === o.id;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOrigen(o.id)}
                  aria-pressed={activo}
                  className={cn(
                    "flex w-full gap-3 rounded-xl border p-3 text-left transition",
                    activo
                      ? "border-brand bg-brand/5 ring-1 ring-brand"
                      : "border-line hover:border-brand/40 hover:bg-surface",
                  )}
                >
                  <o.Icon
                    size={16}
                    className={cn("mt-0.5 shrink-0", activo ? "text-brand" : "text-[var(--text-3)]")}
                  />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-[var(--text)]">{o.nombre}</span>
                    <span className="mt-0.5 block text-[12px] text-[var(--text-2)]">{o.quien}</span>
                    <span className="mt-1 block text-[11.5px] leading-snug text-[var(--text-3)]">
                      {o.dice}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-line px-4 py-3">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-lg px-3 py-2 text-[12.5px] font-semibold text-[var(--text-2)] transition hover:bg-surface"
          >
            Ahora no
          </button>
          <button
            type="button"
            disabled={!origen || lanzando}
            onClick={() => {
              if (!origen) return;
              setLanzando(true);
              onConfirmar(origen);
            }}
            className="rounded-lg bg-brand px-3.5 py-2 text-[12.5px] font-bold text-white shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {lanzando ? "Marcando…" : `Llamar a ${cuantos}`}
          </button>
        </footer>
      </div>
    </div>
  );
}
