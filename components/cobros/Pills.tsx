// Las pastillas de estado del módulo de cobros.
//
// El color no es decoración: en una lista de 300 cuentas es lo primero que lee
// el gestor. Verde = resuelto o comprometido, ámbar = necesita algo, rojo = se
// está perdiendo, gris = todavía no pasó nada.

import { cn } from "@/lib/cn";
import {
  ESTADO_NOMBRE,
  RESULTADO_NOMBRE,
  TRAMO_NOMBRE,
  type EstadoGestion,
  type NivelRiesgo,
  type ResultadoLlamada,
  type TramoMora,
} from "@/lib/cobros-tipos";

const BASE =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold";

type Tono = "verde" | "ambar" | "rojo" | "gris" | "marca";

const TONOS: Record<Tono, string> = {
  verde: "bg-[#e7f7ee] text-[#00693c]",
  ambar: "bg-[#fdf3e3] text-[#8a5300]",
  rojo: "bg-[#fceceb] text-[#b3261e]",
  gris: "bg-[var(--surface-2)] text-[var(--text-2)]",
  marca: "bg-[#eef7e6] text-[#3f6b18]",
};

const TONO_ESTADO: Record<EstadoGestion, Tono> = {
  sin_gestionar: "gris",
  en_gestion: "marca",
  promesa_pago: "verde",
  promesa_rota: "rojo",
  pago_parcial: "verde",
  pagado: "verde",
  negociacion: "ambar",
  disputa: "ambar",
  ilocalizable: "gris",
  no_contactar: "gris",
  legal: "rojo",
};

export function EstadoPill({ estado }: { estado: EstadoGestion }) {
  return (
    <span className={cn(BASE, TONOS[TONO_ESTADO[estado]])}>{ESTADO_NOMBRE[estado]}</span>
  );
}

const TONO_TRAMO: Record<TramoMora, Tono> = {
  al_dia: "verde",
  "1_30": "marca",
  "31_60": "ambar",
  "61_90": "ambar",
  "90_mas": "rojo",
};

export function TramoPill({ tramo, dias }: { tramo: TramoMora; dias?: number }) {
  return (
    <span className={cn(BASE, TONOS[TONO_TRAMO[tramo]])}>
      {dias !== undefined ? `${dias} días` : TRAMO_NOMBRE[tramo]}
    </span>
  );
}

const TONO_RIESGO: Record<NivelRiesgo, Tono> = { bajo: "verde", medio: "ambar", alto: "rojo" };

export function RiesgoPill({ riesgo }: { riesgo: NivelRiesgo }) {
  return <span className={cn(BASE, TONOS[TONO_RIESGO[riesgo]])}>Riesgo {riesgo}</span>;
}

const TONO_RESULTADO: Record<ResultadoLlamada, Tono> = {
  promesa_pago: "verde",
  ya_pago: "verde",
  pago_parcial: "verde",
  no_puede_pagar: "ambar",
  quiere_negociar: "ambar",
  disputa: "ambar",
  numero_equivocado: "gris",
  contesto_tercero: "gris",
  no_contesto: "gris",
  colgo: "rojo",
  pidio_recontacto: "marca",
  solicita_no_llamar: "rojo",
  sin_clasificar: "gris",
};

export function ResultadoPill({ resultado }: { resultado: ResultadoLlamada }) {
  return <span className={cn(BASE, TONOS[TONO_RESULTADO[resultado]])}>{RESULTADO_NOMBRE[resultado]}</span>;
}
