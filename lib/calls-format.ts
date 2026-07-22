// Formateo compartido por la pestana de llamadas. Puro, sin React.
import type { CallOutcome } from "./data/types";

export function fmtDuracion(seg: number | null | undefined): string {
  if (!seg) return "—";
  const m = Math.floor(seg / 60);
  const s = seg % 60;
  return m ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

// Los costos por llamada son centavos de centavo, asi que por debajo de un
// dolar mostramos cuatro decimales o todo se ve como "$0.00".
export function fmtUSD(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return n < 1 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`;
}

export function fmtPorcentaje(fraccion: number): string {
  return `${(fraccion * 100).toFixed(1)}%`;
}

export const ETIQUETA_OUTCOME: Record<CallOutcome, string> = {
  exitosa: "Exitosa",
  transferida: "Transferida",
  falla_carrier: "Falla de carrier",
  falla_plataforma: "Falla de plataforma",
  sin_audio: "Sin audio",
  sin_respuesta: "Sin respuesta",
  otro: "Otro",
};

// Color por categoria, en clases de Tailwind ya usadas en el repo.
export const COLOR_OUTCOME: Record<CallOutcome, string> = {
  exitosa: "bg-emerald-100 text-emerald-800",
  transferida: "bg-sky-100 text-sky-800",
  falla_carrier: "bg-red-100 text-red-800",
  falla_plataforma: "bg-orange-100 text-orange-800",
  sin_audio: "bg-amber-100 text-amber-800",
  sin_respuesta: "bg-slate-100 text-slate-700",
  otro: "bg-slate-100 text-slate-700",
};
