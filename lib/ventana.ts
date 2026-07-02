// Ventana de servicio de WhatsApp: 24h desde el ultimo mensaje del CLIENTE.
// Dentro de la ventana se puede enviar texto libre (IA o manual); fuera, solo
// plantillas aprobadas (el texto libre lo rechaza Meta con error 131047).
const VENTANA_MS = 24 * 60 * 60 * 1000;

export interface EstadoVentana {
  cerrada: boolean;
  texto: string;
  urgente: boolean; // queda menos de 2h
}

export function estadoVentana(ultimoEntranteTs?: string): EstadoVentana {
  if (!ultimoEntranteTs) {
    return { cerrada: true, texto: "Sin mensajes del cliente", urgente: false };
  }
  const ms = new Date(ultimoEntranteTs).getTime() + VENTANA_MS - Date.now();
  if (ms <= 0) return { cerrada: true, texto: "Ventana cerrada", urgente: false };
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return {
    cerrada: false,
    texto: h > 0 ? `${h}h ${m}m` : `${m}m`,
    urgente: ms < 2 * 3_600_000,
  };
}
