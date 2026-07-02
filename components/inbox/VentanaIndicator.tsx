"use client";

import { useEffect, useReducer } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";
import { estadoVentana } from "@/lib/ventana";

// Cuenta regresiva de la ventana de 24h para responder al cliente. Se refresca
// cada minuto. Verde = hay tiempo, ambar = queda poco, rojo = cerrada.
export function VentanaIndicator({
  ultimoEntranteTs,
  visible,
}: {
  ultimoEntranteTs?: string;
  visible: boolean;
}) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const h = setInterval(tick, 60_000);
    return () => clearInterval(h);
  }, []);

  if (!visible) return null;
  const { cerrada, texto, urgente } = estadoVentana(ultimoEntranteTs);

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium leading-tight",
        cerrada
          ? "border-rose-200 bg-rose-50 text-rose-600"
          : urgente
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : "border-emerald-200 bg-emerald-50 text-[#2f9e2f]",
      )}
    >
      <Clock size={14} className="shrink-0" />
      {cerrada ? (
        <span>Ventana cerrada. Solo plantilla aprobada.</span>
      ) : (
        <span>
          Ventana para responder: <b>{texto}</b>
        </span>
      )}
    </div>
  );
}
