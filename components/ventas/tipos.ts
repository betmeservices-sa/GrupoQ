// Lo que la pantalla de ventas recibe de la API, en un solo lugar.
//
// Son los tipos del dominio (lib/ventas-pipeline) más lo que el servidor ya
// dejó calculado, para que ningún componente vuelva a deducir la etapa.

import type {
  Alerta,
  DocConEstado,
  EtapaId,
  ReporteVentas,
  Solicitud,
  SubEstado,
  Vendedor,
} from "@/lib/ventas-pipeline";

export interface Caso extends Solicitud {
  etapa: EtapaId;
  doc: { sub: SubEstado; resumen: string; aprobados: number; total: number };
  documentos: DocConEstado[];
}

export interface EventoCaso {
  ts: string;
  tipo: string;
  actor: string | null;
  detalle: string | null;
}

export interface RespuestaTablero {
  ok: boolean;
  error?: string;
  solicitudes: Caso[];
  vendedores: Vendedor[];
  gerente: Vendedor | null;
  alertas: Alerta[];
}

export type RespuestaReporte = ReporteVentas & { ok: boolean; error?: string; gerente: Vendedor | null };
