// Modelos de dominio del Centro de Comunicación.
// Una sola fuente de verdad para canales, estados, roles y entidades.

export type Channel = "whatsapp" | "instagram" | "facebook" | "internal";

export type ConversationStatus = "nuevo" | "en_progreso" | "resuelto";

// Unión de los departamentos de TODOS los tenants. Cada tenant usa solo los
// suyos (los declara en su seed); el tipo los admite a todos para que un solo
// código base sirva a varios clientes.
export type DepartmentId =
  // Grupo Q (automotriz)
  | "ventas"
  | "usados"
  | "taller"
  | "repuestos"
  | "pintura"
  | "crediq"
  | "atencion"
  // Hospital Centro Ginecológico
  | "ginecologia"
  | "obstetricia"
  | "pediatria"
  | "reproduccion"
  | "laboratorio"
  | "imagenes"
  | "recepcion";

export type RoleId = "recepcion" | "marketing" | "gerente_marketing" | "medico" | "jefe" | "admin";

export interface Department {
  id: DepartmentId;
  nombre: string;
  color: string; // hex para chips/barras
}

export interface StaffUser {
  id: string;
  nombre: string;
  rol: RoleId;
  departamento: DepartmentId;
  iniciales: string;
}

export interface Contact {
  id: string;
  nombre: string;
  telefono?: string;
  handle?: string; // @usuario en redes
  canal: Channel;
  notas?: string;
}

export interface MessageMedia {
  id: string; // media_id de Meta (se baja por /api/whatsapp/media/<id>)
  tipo: string; // image | document | audio | sticker | video
  mime?: string;
  filename?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  autor: "cliente" | "staff";
  staffId?: string;
  texto: string;
  ts: string; // ISO 8601
  media?: MessageMedia;
}

export interface Conversation {
  id: string;
  canal: Channel;
  contactId: string;
  departamento: DepartmentId;
  estado: ConversationStatus;
  asignadoA?: string; // StaffUser.id
  noLeidos: number;
  ultimoMensajeTs: string; // ISO 8601
}

export interface InternalChannel {
  id: string;
  nombre: string;
  tipo: "canal" | "dm";
  miembros: string[]; // StaffUser.id[]
}

export interface InternalMessage {
  id: string;
  channelId: string;
  staffId: string;
  texto: string;
  ts: string; // ISO 8601
}

export type RedSocial = "facebook" | "instagram";

// Métricas por publicación, equivalentes a las que devuelve la API:
// IG media insights (reach, likes, comments, shares, saved) y
// FB post insights (reach, reactions, comments, shares).
export interface PostEngagement {
  alcance: number; // reach
  meGusta: number; // likes / reactions
  comentarios: number; // comments
  compartidos: number; // shares
  guardados?: number; // saved (solo Instagram)
}

export interface SocialPost {
  id: string;
  red: RedSocial;
  estado: "publicado" | "programado" | "borrador";
  texto: string;
  fecha: string; // ISO 8601
  engagement?: PostEngagement; // presente en publicaciones ya publicadas
}

// Estadísticas a nivel de cuenta, equivalentes a Meta Graph API Insights.
// IG: follower_count, reach, views, total_interactions.
// FB: page_fans, page reach, views, page_post_engagements.
export interface SocialStats {
  red: RedSocial;
  handle: string;
  seguidores: number; // follower_count / page_fans
  nuevosSeguidores: number; // crecimiento en 30 días
  crecimientoPct: number; // variación porcentual de seguidores
  alcance30d: number; // reach (30 días)
  vistas30d: number; // views (30 días), reemplaza impressions
  interacciones30d: number; // total_interactions / page_post_engagements
}

export interface Metric {
  label: string;
  valor: string | number;
  delta?: number; // variación porcentual, positiva o negativa
}

// --- Plantillas de WhatsApp (Meta message templates) ---
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type TemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "PAUSED"
  | "DISABLED";

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  buttons?: Array<{ type: string; text: string; url?: string; phone_number?: string }>;
  example?: { header_text?: string[]; body_text?: string[][] };
}

export interface WaTemplate {
  id?: string;
  name: string;
  language: string;
  category: TemplateCategory;
  status: TemplateStatus;
  components: TemplateComponent[];
}

// --- Llamadas (Vapi) ---
// Modelo de lectura, equivalente a lo que devuelve la API de Vapi (GET /call).
export type CallDirection = "inbound" | "outbound" | "web";

export interface CallRecord {
  id: string;
  direccion: CallDirection;
  numeroCliente?: string; // customer.number
  inicio?: string; // startedAt, ISO 8601
  fin?: string; // endedAt, ISO 8601
  duracionSeg: number; // derivado de inicio/fin
  costo: number; // USD
  estadoFinal?: string; // endedReason de Vapi
  assistantId?: string;
}

export interface CallMetrics {
  total: number;
  entrantes: number;
  salientes: number;
  conectadas: number; // con duración > 0
  minutosTotales: number;
  duracionPromedioSeg: number;
  costoTotal: number;
}
