"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const TZ = "America/El_Salvador";

// La MISMA hora real (new Date()) que el código le pasa a la IA en cada mensaje.
// Aquí solo la mostramos al staff. Se calcula en el cliente tras montar, para
// no chocar con el render del servidor (hidratación).
function ahoraSV(): { fecha: string; hora: string } {
  const d = new Date();
  const fechaRaw = new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  const fecha = fechaRaw.charAt(0).toUpperCase() + fechaRaw.slice(1);
  const hora = new Intl.DateTimeFormat("es-ES", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(d);
  return { fecha, hora };
}

export function Reloj() {
  const [t, setT] = useState<{ fecha: string; hora: string } | null>(null);

  useEffect(() => {
    setT(ahoraSV());
    const id = setInterval(() => setT(ahoraSV()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!t) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-surface/60 px-3 py-2">
      <Clock size={15} className="shrink-0 text-brand" />
      <div className="min-w-0 leading-tight">
        <p className="text-[13px] font-bold text-[#0f1b2d]">{t.hora}</p>
        <p className="truncate text-[11px] text-[#94a3b4]">{t.fecha}</p>
      </div>
    </div>
  );
}
