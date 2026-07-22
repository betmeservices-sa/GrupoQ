// Modelos de dominio del Centro de Comunicación.
// Una sola fuente de verdad para canales, estados, roles y entidades.

export type Channel = "whatsapp" | "instagram" | "facebook" | "internal";

export type ConversationStatus = "nuevo" | "en_progreso" | "resuelto";

// Unión de los departamentos de TODOS los tenants. Cada tenant usa solo los
// suyos (los declara en su seed); el tipo los admite a todos para que un solo
// código base sirva a varios clientes.
export type DepartmentId =
  // Automotriz (Grupo Q y Excel comparten ventas/usados/taller/repuestos/atencion)
  | "ventas"
  | "usados"
  | "taller"
  | "repuestos"
  | "pintura"
  | "crediq"
  | "financiamiento" // Excel: AutoFácil
  | "atencion"
  // Hospital Centro Ginecológico
  | "ginecologia"
  | "obstetricia"
  | "pediatria"
  | "reproduccion"
  | "laboratorio"
  | "imagenes"
  | "recepcion"
  // MiAgentIA (agencia de agentes IA)
  | "soporte"
  | "onboarding";

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
  apellido?: string;
  correo?: string;
  telefono?: string;
  handle?: string; // @usuario en redes
  canal: Channel;
  notas?: string;
  tags?: string[]; // etiquetas de interés/estado (definidas por tenant)
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

export type CallOutcome =
  | "exitosa"
  | "transferida"
  | "falla_carrier"
  | "falla_plataforma"
  | "sin_audio"
  | "sin_respuesta"
  | "otro";

export interface CallCostBreakdown {
  transport: number;
  stt: number;
  llm: number;
  tts: number;
  vapi: number;
  total: number;
  // Consumo bruto. ttsCharacters son los caracteres que la voz (ElevenLabs)
  // sintetizo en esa llamada; con llave propia de 11labs el costo tts llega en
  // 0 porque lo factura esa cuenta, no Vapi.
  ttsCharacters: number;
  llmPromptTokens: number;
  llmCompletionTokens: number;
}

export interface CallRecord {
  id: string;
  direccion: CallDirection;
  numeroCliente?: string; // customer.number
  inicio?: string; // startedAt, ISO 8601. Momento en que CONTESTARON.
  fin?: string; // endedAt, ISO 8601
  duracionSeg: number; // tiempo de habla, derivado de inicio/fin
  costo: number; // USD, lo que cobra Vapi
  estadoFinal?: string; // endedReason de Vapi
  assistantId?: string;
  // --- campos agregados para el dashboard de llamadas ---
  creada?: string; // createdAt, ISO 8601. Momento en que se origino la llamada.
  phoneNumberId?: string;
  numeroPropio?: string; // resuelto contra GET /phone-number
  nombreNumero?: string; // nombre del numero en Vapi, ej. "BetMe Services"
  nombreAssistant?: string; // resuelto contra GET /assistant
  estado?: string; // status de Vapi (queued, ringing, in-progress, ended)
  costoDesglose?: CallCostBreakdown;
  transcript?: string;
  grabacionUrl?: string;
}

// Metricas por llamada, derivadas de los tres timestamps.
export interface CallDerived {
  ringSeg: number | null; // null = nunca contestaron
  hablaSeg: number;
  costoPorMinuto: number | null; // null = no hubo habla
  outcome: CallOutcome;
}

export interface PrefijoStats {
  prefijo: string;
  total: number;
  conectadas: number;
  tasa: number; // 0..1
}

export interface CallMetrics {
  total: number;
  entrantes: number;
  salientes: number;
  conectadas: number; // con duración > 0
  minutosTotales: number;
  duracionPromedioSeg: number;
  costoTotal: number;
  // --- agregados nuevos ---
  tasaConexion: number; // 0..1
  costoPorMinutoPromedio: number | null;
  ringPromedioSeg: number | null;
  desglose: CallCostBreakdown;
  porOutcome: Record<CallOutcome, number>;
  porPrefijo: PrefijoStats[];
  costoCarrier: number; // minutos hablados * tarifa configurada
  costoReal: number; // costoTotal + costoCarrier
  // Consumo de voz. Util para vigilar la cuota de ElevenLabs, que ya tumbo
  // llamadas antes (pipeline-error-eleven-labs-voice-failed).
  caracteresTTS: number;
  caracteresPorLlamada: number;
}
