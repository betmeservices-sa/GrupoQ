// Modelos del tenant "inmobiliaria" (Terrazul Bienes Raíces, El Salvador).
// Se comparten entre el servidor (rutas de API), las pantallas y los tests.

// ── Visitas ──

// Lo que hay que saber de una visita. Cuelga del lead a propósito: la agenda es
// la etapa "visita agendada" mirada por fecha, no una lista aparte que se
// desincroniza al primer cambio (ver lib/inmobiliaria-visitas).
export interface VisitaAgendada {
  propiedadId: string;
  enDias?: number; // semillas: relativo a hoy, así el demo no envejece
  fecha?: string; // agendada en el demo: día exacto (AAAA-MM-DD)
  hora: string; // "10:00", 24 horas
  duracionMin?: number;
  // El cliente dijo que ahí va a estar. Sin esto, el agente no debería salir sin
  // llamar antes.
  confirmada: boolean;
  nota?: string;
}

// ── Operación ──

// Vender y alquilar son dos negocios distintos, no dos etiquetas. Cambian el
// precio (total contra mensual), lo que califica al interesado y hasta el
// nombre de la última etapa. Todo lo que diverge cuelga de este tipo.
export type TipoOperacion = "venta" | "alquiler";

export const OPERACIONES: TipoOperacion[] = ["venta", "alquiler"];

export const OPERACION_NOMBRE: Record<TipoOperacion, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
};

// Como se dice en el anuncio: "casa en venta", "casa en alquiler".
export const OPERACION_EN: Record<TipoOperacion, string> = {
  venta: "en venta",
  alquiler: "en alquiler",
};

// ── Pipeline ──

// Etapas del embudo. "no_calificado" NO es descarte: es quien todavía no puede
// (sin prima, sin historial, sin fiador). Vuelven en meses y por eso conservan
// su columna en vez de irse a la basura.
export type Etapa =
  | "nuevo"
  | "calificado"
  | "no_calificado"
  | "visita"
  | "oferta"
  | "cerrado";

// Cómo va a pagar una COMPRA. En El Salvador esto decide qué se le puede
// ofrecer a alguien: el FSV tiene tope de precio y exige vivienda que califique;
// el banco pide prima y avalúo; el contado se mueve en otro rango y a otra
// velocidad. En un alquiler nada de esto aplica.
export type FormaPago = "contado" | "fsv" | "banco" | "sin_definir";

// Qué respalda el pago de un ALQUILER. Al propietario no le importa el FSV ni
// la carta del banco: quiere saber de dónde sale la renta cada mes y quién
// responde si deja de entrar.
export type RespaldoAlquiler = "ingreso" | "fiador" | "deposito" | "sin_definir";

// El carril del pipeline: lo que califica al lead, según la operación. Nunca se
// mezclan carriles de venta con los de alquiler en el mismo tablero.
export type Carril = FormaPago | RespaldoAlquiler;

export type CanalLead = "whatsapp" | "messenger" | "instagram" | "comentario";

export const ETAPAS: Etapa[] = [
  "nuevo",
  "calificado",
  "no_calificado",
  "visita",
  "oferta",
  "cerrado",
];

export const FORMAS_PAGO: FormaPago[] = ["contado", "fsv", "banco", "sin_definir"];

export const RESPALDOS: RespaldoAlquiler[] = ["ingreso", "fiador", "deposito", "sin_definir"];

export const CARRILES: Record<TipoOperacion, Carril[]> = {
  venta: FORMAS_PAGO,
  alquiler: RESPALDOS,
};

export const ETAPA_NOMBRE: Record<Etapa, string> = {
  nuevo: "Nuevo",
  calificado: "Calificado",
  no_calificado: "No calificado",
  visita: "Visita agendada",
  oferta: "Oferta",
  cerrado: "Cerrado",
};

// En alquiler no hay "oferta": hay contrato. Y no se cierra una venta, se
// entrega la llave. Solo cambian las dos etapas del final.
const ETAPA_NOMBRE_ALQUILER: Partial<Record<Etapa, string>> = {
  oferta: "Contrato",
  cerrado: "Entregada",
};

export function nombreEtapa(etapa: Etapa, operacion: TipoOperacion): string {
  if (operacion === "alquiler") return ETAPA_NOMBRE_ALQUILER[etapa] ?? ETAPA_NOMBRE[etapa];
  return ETAPA_NOMBRE[etapa];
}

export const CARRIL_NOMBRE: Record<Carril, string> = {
  contado: "Contado",
  fsv: "FSV",
  banco: "Banco",
  ingreso: "Ingreso comprobable",
  fiador: "Fiador",
  deposito: "Depósito adelantado",
  sin_definir: "Sin definir",
};

// Lo que hay que saber de cada carril para no ofrecer lo que no se puede.
export const CARRIL_DETALLE: Record<Carril, string> = {
  contado: "Cierra rápido y sin avalúo de por medio",
  fsv: "Fondo Social para la Vivienda, con tope de precio",
  banco: "Necesita prima y aprobación previa",
  ingreso: "Constancia de salario o estados de cuenta",
  fiador: "Alguien que firma y responde por la renta",
  deposito: "Paga meses por adelantado en vez de fiador",
  sin_definir: "Falta preguntar con qué respalda el pago",
};

// Alias que se lee mejor donde solo hay venta.
export const FORMA_PAGO_NOMBRE = CARRIL_NOMBRE;
export const FORMA_PAGO_DETALLE = CARRIL_DETALLE;

// Desde cuándo necesita la propiedad. En alquiler es la mitad de la
// calificación: el que se muda en tres días no espera papeleo de dos semanas.
export type UrgenciaMudanza = "inmediata" | "este_mes" | "mas_adelante" | "sin_definir";

export const MUDANZA_NOMBRE: Record<UrgenciaMudanza, string> = {
  inmediata: "La necesita ya",
  este_mes: "Se muda este mes",
  mas_adelante: "Más adelante",
  sin_definir: "Sin fecha",
};

export function urgenciaMudanza(enDias: number | undefined): UrgenciaMudanza {
  if (typeof enDias !== "number") return "sin_definir";
  if (enDias <= 7) return "inmediata";
  if (enDias <= 30) return "este_mes";
  return "mas_adelante";
}

// Semilla de un lead. `hace` son los días desde el último contacto: se guarda
// relativo para que el demo no envejezca, y la fecha se calcula contra el día en
// que se abre el tablero.
//
// `formaPago` solo tiene sentido en venta y `respaldo` solo en alquiler: se
// dejan opcionales a propósito para no forzar un FSV donde no aplica. El carril
// se resuelve con carrilDe().
export interface LeadSemilla {
  id: string;
  nombre: string;
  canal: CanalLead;
  operacion: TipoOperacion;
  etapa: Etapa;
  visita?: VisitaAgendada; // solo cuando la etapa es "visita"
  formaPago?: FormaPago; // venta
  respaldo?: RespaldoAlquiler; // alquiler
  mudanzaEnDias?: number; // alquiler: en cuántos días la necesita
  presupuesto: number; // USD. Venta: el techo total. Alquiler: renta MENSUAL.
  zona: string;
  busca: string; // qué busca, en una línea
  hace: number; // días sin contacto
  asesorId: string;
  propiedadId?: string; // propiedad de la cartera que está viendo
  nota?: string;
}

// Lead ya resuelto contra el día de hoy, listo para pintar.
export interface Lead extends LeadSemilla {
  ultimoContacto: string; // AAAA-MM-DD
  dias: number;
  urgencia: Urgencia;
  carril: Carril;
  mudanza: UrgenciaMudanza;
  mudanzaEl?: string; // AAAA-MM-DD, solo si dijo desde cuándo
}

export type Urgencia = "al_dia" | "enfriando" | "abandonado";

export interface ResumenCarril {
  carril: Carril;
  leads: number;
  monto: number; // suma de presupuestos (mensuales en alquiler)
}

export interface ResumenEtapa {
  etapa: Etapa;
  leads: number;
  monto: number;
}

// El tablero de UNA operación. Nunca se suma el dinero de las dos: un techo de
// compra de $400,000 y una renta de $650 al mes no son la misma unidad.
export interface TableroOperacion {
  operacion: TipoOperacion;
  leads: Lead[];
  porCarril: ResumenCarril[];
  porEtapa: ResumenEtapa[];
  sinTocar: number;
  enJuego: number; // venta: dólares. alquiler: dólares AL MES.
}

export interface Pipeline {
  hoy: string;
  leads: Lead[];
  venta: TableroOperacion;
  alquiler: TableroOperacion;
  // Leads que ya se enfriaron o se abandonaron, sin contar los cerrados.
  sinTocar: number;
}

// ── Cartera ──

export type TipoPropiedad = "casa" | "apartamento" | "terreno" | "local";

export type EstadoPropiedad = "disponible" | "apartada" | "vendida";

export type Ambiente =
  | "fachada"
  | "sala"
  | "cocina"
  | "habitacion"
  | "bano"
  | "patio"
  | "terreno"
  | "local"
  | "plano";

export const TIPO_NOMBRE: Record<TipoPropiedad, string> = {
  casa: "Casa",
  apartamento: "Apartamento",
  terreno: "Terreno",
  local: "Local comercial",
};

export const ESTADO_NOMBRE: Record<EstadoPropiedad, string> = {
  disponible: "Disponible",
  apartada: "Apartada",
  vendida: "Vendida",
};

// Una casa en alquiler no se "vende" ni se "aparta": se reserva y se entrega.
const ESTADO_NOMBRE_ALQUILER: Record<EstadoPropiedad, string> = {
  disponible: "Disponible",
  apartada: "Reservada",
  vendida: "Alquilada",
};

export function nombreEstado(estado: EstadoPropiedad, operacion: TipoOperacion): string {
  return operacion === "alquiler" ? ESTADO_NOMBRE_ALQUILER[estado] : ESTADO_NOMBRE[estado];
}

export const AMBIENTE_NOMBRE: Record<Ambiente, string> = {
  fachada: "Fachada",
  sala: "Sala",
  cocina: "Cocina",
  habitacion: "Habitación",
  bano: "Baño",
  patio: "Patio",
  terreno: "Terreno",
  local: "Local",
  plano: "Plano",
};

export interface Foto {
  src: string;
  ambiente: Ambiente;
  ancho: number;
  alto: number;
}

export interface PropiedadSemilla {
  id: string;
  codigo: string; // el que usa el agente al hablar, ej. TZ-101
  operacion: TipoOperacion;
  tipo: TipoPropiedad;
  titulo: string;
  zona: string;
  municipio: string;
  // Venta: el precio total. Alquiler: la renta MENSUAL. Nunca se comparan ni se
  // suman entre sí sin mirar antes la operación.
  precio: number; // USD
  deposito?: number; // alquiler: lo que se deja en depósito
  plazoMinimoMeses?: number; // alquiler: contrato mínimo
  estado: EstadoPropiedad;
  publicada: boolean; // sigue visible en portales y redes
  habitaciones: number;
  banos: number;
  parqueos: number;
  areaConstruccion: number; // m²
  areaTerreno: number; // v² (vara cuadrada, la medida de la escritura)
  anio?: number;
  propietario: { nombre: string; telefono: string };
  exclusiva: boolean;
  // Días desde hoy hasta el vencimiento de la exclusiva. Negativo = ya venció.
  exclusivaEnDias?: number;
  caracteristicas: string[];
  resumen: string; // lo que el agente diría de viva voz
  fotos: Foto[];
}

export interface Propiedad extends PropiedadSemilla {
  exclusivaHasta?: string; // AAAA-MM-DD
  diasDeExclusiva?: number;
  // Apartada o vendida y todavía publicada: el error caro.
  publicadaSinEstar: boolean;
  exclusivaVencida: boolean;
  exclusivaPorVencer: boolean;
  interesados: number; // leads vivos mirando esta propiedad
}

export interface Cartera {
  hoy: string;
  propiedades: Propiedad[];
  resumen: {
    total: number;
    disponibles: number;
    apartadas: number;
    vendidas: number;
    // Dos bolsas separadas: el valor de lo que está a la venta y la renta que
    // entraría al mes si se alquilara todo lo disponible.
    enVenta: number;
    enAlquiler: number;
    valorVenta: number;
    rentaMensual: number;
    exclusivas: number;
  };
  alertas: {
    publicadasSinEstar: string[]; // códigos
    exclusivasVencidas: string[];
    exclusivasPorVencer: string[];
  };
}

// ── Publicación ──

export interface FormatoRed {
  id: "instagram" | "facebook";
  nombre: string;
  ancho: number;
  alto: number;
}

export const FORMATOS: FormatoRed[] = [
  { id: "instagram", nombre: "Instagram", ancho: 1080, alto: 1350 },
  { id: "facebook", nombre: "Facebook", ancho: 1200, alto: 1500 },
];

export interface Anuncio {
  titulo: string;
  descripcion: string;
  hashtags: string[];
  encuentra24: string;
  // Fotos ordenadas para el carrusel, con el motivo del orden.
  carrusel: Foto[];
  ordenExplicado: string;
  // Datos que van estampados en la portada.
  portada: {
    precio: string; // "$425,000" o "$650/mes"
    etiqueta: string; // "CASA EN ALQUILER", la pastilla de arriba
    zona: string;
    tipo: string;
    codigo: string;
    datos: string[];
    foto: Foto | null;
  };
  // Lo que NO se puede publicar, por estado de la propiedad.
  bloqueo: string | null;
  advertencia: string | null;
}
