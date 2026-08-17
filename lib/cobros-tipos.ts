// Modelo de dominio del módulo de COBROS (tenant "promerica").
//
// La pieza central es el Deudor: su ficha es lo que la IA actualiza después de
// cada llamada. Todo lo demás (campañas, importaciones, gestiones) existe para
// alimentar o mover esa ficha.
//
// Montos en dólares (El Salvador). Fechas en ISO 8601.

export type ProductoCredito =
  | "tarjeta"
  | "prestamo_personal"
  | "auto"
  | "vivienda"
  | "pyme";

export const PRODUCTO_NOMBRE: Record<ProductoCredito, string> = {
  tarjeta: "Tarjeta de crédito",
  prestamo_personal: "Préstamo personal",
  auto: "Crédito de auto",
  vivienda: "Crédito de vivienda",
  pyme: "Crédito PYME",
};

// Tramos de mora del banco. El tramo NO se guarda: se deriva de los días para
// que nunca queden en desacuerdo.
export type TramoMora = "al_dia" | "1_30" | "31_60" | "61_90" | "90_mas";

export const TRAMO_NOMBRE: Record<TramoMora, string> = {
  al_dia: "Al día",
  "1_30": "1 a 30 días",
  "31_60": "31 a 60 días",
  "61_90": "61 a 90 días",
  "90_mas": "Más de 90 días",
};

export function tramoDe(diasMora: number): TramoMora {
  if (diasMora <= 0) return "al_dia";
  if (diasMora <= 30) return "1_30";
  if (diasMora <= 60) return "31_60";
  if (diasMora <= 90) return "61_90";
  return "90_mas";
}

// Estado de gestión de la cuenta. Es lo que decide en qué columna cae el deudor
// y si sigue entrando a las campañas de llamadas.
export type EstadoGestion =
  | "sin_gestionar"
  | "en_gestion"
  | "promesa_pago"
  | "promesa_rota"
  | "pago_parcial"
  | "pagado"
  | "negociacion"
  | "disputa"
  | "ilocalizable"
  | "no_contactar"
  | "legal";

export const ESTADO_NOMBRE: Record<EstadoGestion, string> = {
  sin_gestionar: "Sin gestionar",
  en_gestion: "En gestión",
  promesa_pago: "Promesa de pago",
  promesa_rota: "Promesa incumplida",
  pago_parcial: "Pago parcial",
  pagado: "Pagado",
  negociacion: "En negociación",
  disputa: "Reclamo abierto",
  ilocalizable: "Ilocalizable",
  no_contactar: "Pidió no ser contactado",
  legal: "Pasado a legal",
};

// Cómo terminó una llamada, desde el punto de vista del cobro (no de la
// telefonía). Es la etiqueta que la IA saca del transcript.
export type ResultadoLlamada =
  | "promesa_pago"
  | "ya_pago"
  | "pago_parcial"
  | "no_puede_pagar"
  | "quiere_negociar"
  | "disputa"
  | "numero_equivocado"
  | "contesto_tercero"
  | "no_contesto"
  | "colgo"
  | "pidio_recontacto"
  | "solicita_no_llamar"
  | "sin_clasificar";

export const RESULTADO_NOMBRE: Record<ResultadoLlamada, string> = {
  promesa_pago: "Prometió pagar",
  ya_pago: "Dice que ya pagó",
  pago_parcial: "Puede abonar una parte",
  no_puede_pagar: "No puede pagar",
  quiere_negociar: "Quiere refinanciar",
  disputa: "Reclama el saldo",
  numero_equivocado: "Número equivocado",
  contesto_tercero: "Contestó otra persona",
  no_contesto: "No contestó",
  colgo: "Colgó",
  pidio_recontacto: "Pidió que lo llamen después",
  solicita_no_llamar: "Pidió no ser llamado",
  sin_clasificar: "Sin clasificar",
};

// Resultados que cuentan como contacto efectivo con el titular. La tasa de
// contacto de una campaña se calcula con esto.
export const RESULTADOS_CONTACTO: ResultadoLlamada[] = [
  "promesa_pago",
  "ya_pago",
  "pago_parcial",
  "no_puede_pagar",
  "quiere_negociar",
  "disputa",
  "pidio_recontacto",
  "solicita_no_llamar",
];

export type Sentimiento = "cooperativo" | "neutral" | "evasivo" | "molesto";

export const SENTIMIENTO_NOMBRE: Record<Sentimiento, string> = {
  cooperativo: "Cooperativo",
  neutral: "Neutral",
  evasivo: "Evasivo",
  molesto: "Molesto",
};

export type NivelRiesgo = "bajo" | "medio" | "alto";

// Qué hacer después. La campaña lee esto para decidir si vuelve a marcar.
export type ProximaAccionTipo =
  | "recontactar"
  | "esperar_pago"
  | "enviar_convenio"
  | "escalar_humano"
  | "escalar_legal"
  | "cerrar"
  | "sacar_de_campana";

export const ACCION_NOMBRE: Record<ProximaAccionTipo, string> = {
  recontactar: "Volver a llamar",
  esperar_pago: "Esperar el pago",
  enviar_convenio: "Enviar propuesta de convenio",
  escalar_humano: "Pasar a un gestor",
  escalar_legal: "Pasar a legal",
  cerrar: "Cerrar la gestión",
  sacar_de_campana: "Sacar de la campaña",
};

export interface PromesaPago {
  monto: number;
  fecha: string; // AAAA-MM-DD comprometida
  registrada: string; // ISO del momento en que se tomó
  origen: "ia" | "gestor";
  cumplida?: boolean;
}

export interface ProximaAccion {
  tipo: ProximaAccionTipo;
  cuando?: string; // AAAA-MM-DD sugerido
  nota?: string;
}

// Una entrada del historial de la ficha. Todo lo que le pasó a la cuenta queda
// acá, en orden, con quién lo hizo.
export interface Gestion {
  id: string;
  tipo: "llamada" | "nota" | "whatsapp" | "pago" | "sistema";
  cuando: string; // ISO 8601
  autor: "ia" | "gestor" | "sistema";
  resumen: string;
  resultado?: ResultadoLlamada;
  duracionSeg?: number;
  callId?: string;
  campanaId?: string;
  // Transcript de la llamada, cuando lo hay. Es la fuente de lo que la IA leyó.
  transcript?: string;
  grabacionUrl?: string;
}

export interface Deudor {
  id: string;
  nombre: string;
  documento: string; // DUI enmascarado, ej. "0123****-4"
  telefono: string; // E.164
  telefonoAlterno?: string;
  correo?: string;
  producto: ProductoCredito;
  cuenta: string; // enmascarada, ej. "****4471"
  saldoTotal: number;
  montoVencido: number;
  cuotaMensual: number;
  diasMora: number;
  ultimoPago?: { fecha: string; monto: number };
  estado: EstadoGestion;
  riesgo: NivelRiesgo;
  sentimiento?: Sentimiento;
  promesa?: PromesaPago;
  proximaAccion?: ProximaAccion;
  // Lo último que la IA entendió de la cuenta, en una frase. Es lo que lee el
  // gestor antes de marcar.
  resumenIa?: string;
  etiquetas: string[];
  gestiones: Gestion[];
  actualizado: string; // ISO
  // Se apaga cuando el cliente pide no ser llamado o la cuenta ya se cobró.
  llamable: boolean;
}

// Vista derivada: el deudor con lo que se calcula al vuelo.
export interface DeudorVista extends Deudor {
  tramo: TramoMora;
  // Días que faltan (negativo = vencida) para la promesa vigente.
  diasParaPromesa?: number;
  promesaVencida: boolean;
  ultimaLlamada?: Gestion;
  intentos: number;
}

export interface ResumenCartera {
  cuentas: number;
  saldoTotal: number;
  montoVencido: number;
  promesasVigentes: number;
  montoPrometido: number;
  // Promesas que ya pasaron de fecha sin marcarse como cumplidas. Es el número
  // que un supervisor mira primero: son las que se caen si nadie las toca.
  promesasVencidas: number;
  recuperadoMes: number;
  porTramo: Record<TramoMora, { cuentas: number; monto: number }>;
  porEstado: Record<EstadoGestion, number>;
  contactadosHoy: number;
  tasaContactoPct: number;
}

// ── Campañas de llamadas (batch) ──

export type EstadoCampana =
  | "borrador"
  | "corriendo"
  | "pausada"
  | "terminada"
  | "cancelada";

export const CAMPANA_ESTADO_NOMBRE: Record<EstadoCampana, string> = {
  borrador: "Borrador",
  corriendo: "Corriendo",
  pausada: "En pausa",
  terminada: "Terminada",
  cancelada: "Cancelada",
};

export type EstadoItem =
  | "pendiente"
  | "marcando"
  | "en_curso"
  | "terminada"
  | "fallida"
  | "reprogramada"
  | "omitida";

export interface ItemCampana {
  id: string;
  deudorId: string;
  nombre: string;
  telefono: string; // E.164
  estado: EstadoItem;
  intentos: number;
  callId?: string;
  resultado?: ResultadoLlamada;
  duracionSeg?: number;
  costo?: number;
  error?: string;
  // Cuándo se puede volver a marcar (ISO). La usa el reintento y el "llámame
  // más tarde".
  reintentarDespues?: string;
  actualizado: string;
}

// Ventana horaria en que la campaña puede marcar. Fuera de ella el planificador
// no entrega nada, aunque la campaña esté "corriendo": llamar a cobrar a las
// once de la noche es la forma más rápida de perder al cliente.
export interface VentanaLlamado {
  horaInicio: number; // 0-23, hora local de El Salvador
  horaFin: number; // 0-23, exclusiva
  dias: number[]; // 0 domingo … 6 sábado
}

export interface Campana {
  id: string;
  nombre: string;
  estado: EstadoCampana;
  creada: string;
  iniciada?: string;
  terminada?: string;
  assistantId: string;
  phoneNumberId: string;
  // El "de 10 en 10": cuántas llamadas puede tener vivas al mismo tiempo.
  concurrencia: number;
  maxIntentos: number;
  // Minutos que espera antes de reintentar un número que no contestó.
  minutosEntreIntentos: number;
  ventana: VentanaLlamado;
  items: ItemCampana[];
  // Se llena cuando el origen fue un archivo subido.
  origenArchivo?: string;
  // true = la campaña NO marca de verdad, produce resultados simulados.
  //
  // Es un campo de la campaña y no una variable de entorno a propósito. La
  // cartera sembrada del demo lleva teléfonos inventados: si el interruptor
  // fuera "hay llave de Vapi, entonces marca", abrir el demo con las
  // credenciales puestas serviría para llamarle en frío a cientos de personas
  // que no tienen nada que ver. Marcar de verdad tiene que ser una decisión
  // que alguien tomó por escrito, por campaña.
  simulada: boolean;
}

export interface ProgresoCampana {
  total: number;
  pendientes: number;
  enCurso: number;
  terminadas: number;
  fallidas: number;
  omitidas: number;
  contactos: number;
  promesas: number;
  montoPrometido: number;
  minutos: number;
  costo: number;
  completadoPct: number;
  tasaContactoPct: number;
}

// Resumen de campaña sin la lista de items. Con 10,000 filas, mandar el arreglo
// completo a la pantalla de listado es lo que tumba el navegador.
export type CampanaResumen = Omit<Campana, "items"> & { progreso: ProgresoCampana };
