// Modelos del tenant "inmobiliaria" (Terrazul Bienes Raíces, El Salvador).
// Se comparten entre el servidor (rutas de API), las pantallas y los tests.

// ── Pipeline ──

// Etapas del embudo de venta. "no_calificado" NO es descarte: es quien todavía
// no puede comprar (sin prima, sin historial, sin cuota). Vuelven en meses y por
// eso conservan su columna en vez de irse a la basura.
export type Etapa =
  | "nuevo"
  | "calificado"
  | "no_calificado"
  | "visita"
  | "oferta"
  | "cerrado";

// Cómo va a pagar. En El Salvador esto decide qué se le puede ofrecer a alguien:
// el FSV tiene tope de precio y exige vivienda que califique; el banco pide prima
// y avalúo; el contado se mueve en otro rango y a otra velocidad.
export type FormaPago = "contado" | "fsv" | "banco" | "sin_definir";

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

export const ETAPA_NOMBRE: Record<Etapa, string> = {
  nuevo: "Nuevo",
  calificado: "Calificado",
  no_calificado: "No calificado",
  visita: "Visita agendada",
  oferta: "Oferta",
  cerrado: "Cerrado",
};

export const FORMA_PAGO_NOMBRE: Record<FormaPago, string> = {
  contado: "Contado",
  fsv: "FSV",
  banco: "Banco",
  sin_definir: "Sin definir",
};

// Lo que hay que saber de cada forma de pago para no ofrecer lo que no se puede.
export const FORMA_PAGO_DETALLE: Record<FormaPago, string> = {
  contado: "Cierra rápido y sin avalúo de por medio",
  fsv: "Fondo Social para la Vivienda, con tope de precio",
  banco: "Necesita prima y aprobación previa",
  sin_definir: "Falta preguntar cómo va a pagar",
};

// Semilla de un lead. `hace` son los días desde el último contacto: se guarda
// relativo para que el demo no envejezca, y la fecha se calcula contra el día en
// que se abre el tablero.
export interface LeadSemilla {
  id: string;
  nombre: string;
  canal: CanalLead;
  etapa: Etapa;
  formaPago: FormaPago;
  presupuesto: number; // USD, el techo que declaró
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
}

export type Urgencia = "al_dia" | "enfriando" | "abandonado";

export interface ResumenFormaPago {
  formaPago: FormaPago;
  leads: number;
  monto: number; // suma de presupuestos
}

export interface ResumenEtapa {
  etapa: Etapa;
  leads: number;
  monto: number;
}

export interface Pipeline {
  hoy: string;
  leads: Lead[];
  porFormaPago: ResumenFormaPago[];
  porEtapa: ResumenEtapa[];
  // Leads que ya se enfriaron o se abandonaron, sin contar los cerrados.
  sinTocar: number;
  enJuego: number; // dinero de los leads que siguen vivos
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
  tipo: TipoPropiedad;
  titulo: string;
  zona: string;
  municipio: string;
  precio: number; // USD
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
    valorDisponible: number;
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
    precio: string;
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
