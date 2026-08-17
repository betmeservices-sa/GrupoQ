// Configuración por cliente (tenant) del Centro de Comunicación.
// Un solo código base sirve a varios clientes: el login decide el tenant activo
// y toda la UI lee su marca, datos semilla, roles, métricas y persona de IA de
// aquí. Sumar un cliente nuevo = agregar un TenantConfig, sin duplicar código.

import type {
  Channel,
  Contact,
  Conversation,
  DepartmentId,
  Department,
  InternalChannel,
  InternalMessage,
  Message,
  Metric,
  RoleId,
  SocialPost,
  SocialStats,
  StaffUser,
  WaTemplate,
} from "@/lib/data/types";

export type TenantId =
  | "hospital"
  | "grupoq"
  | "excel"
  | "miagentia"
  | "hotel"
  | "inmobiliaria"
  | "promerica";

// Datos semilla (mock) de un tenant. Misma forma que el antiguo lib/data/seed.
export interface TenantSeed {
  ME: string;
  departments: Department[];
  staff: StaffUser[];
  contacts: Contact[];
  conversations: Conversation[];
  messages: Message[];
  internalChannels: InternalChannel[];
  internalMessages: InternalMessage[];
  socialPosts: SocialPost[];
  socialStats: SocialStats[];
  metrics: Metric[];
}

// Marca visible del tenant. Los colores viven en globals.css por [data-tenant];
// aquí va lo que no es CSS (nombre, logo, textos).
export interface TenantBrand {
  nombre: string; // nombre completo, ej. "Hospital Centro Ginecológico"
  nombreCorto: string; // para la barra móvil, ej. "Grupo Q"
  tagline: string; // lema, ej. "Somos parte de tu vida"
  loginTitulo: string; // título en el login, ej. "Centro de Comunicación"
  emailPlaceholder: string; // placeholder del correo, ej. "nombre@grupoq.com"
  // Si hay logoSrc, Brand pinta un <img>; si no, pinta el wordmark (ícono + texto).
  logoSrc?: string;
  logoAlt?: string;
  // Logo dibujado en SVG dentro del componente, para marcas cuyo logotipo no
  // sobrevive a un <img> (fondo blanco quemado, baja resolución) y que además
  // necesitan la tipografía de la app. Gana sobre logoSrc y wordmark.
  logoComponent?: "promerica";
  wordmark?: {
    icon: "HeartPulse" | "CarFront" | "Bot" | "Hotel" | "Building2";
    titulo: string;
    subtitulo: string;
  };
}

// Cómo se muestra al contacto externo según el tenant (paciente vs cliente).
export interface TenantLabels {
  contacto: string; // singular, ej. "paciente" / "cliente"
  contactoPlural: string; // plural, ej. "pacientes" / "clientes"
}

// Una tarjeta del dashboard. kind decide de dónde sale el valor.
export interface DashboardCard {
  label: string;
  icon: string; // nombre del ícono lucide (mapeado en la página)
  kind: "metric" | "resolucionPct" | "sinAsignar";
  metricLabel?: string; // para kind "metric": label exacta en seed.metrics
  fallback?: string | number;
}

// Datos de WhatsApp Cloud API por tenant. Semilla para modo REAL: el webhook
// enruta por phone_number_id → tenant. En modo demo/FAKE queda vacío.
export interface TenantWhatsApp {
  phoneNumberId?: string;
}

// Agente de voz del tenant. La cuenta de voz es UNA sola y tiene agentes de
// varios clientes mezclados, así que este id es la frontera: un cliente solo ve
// (y solo puede marcar con) SU agente. Sin este bloque, el tenant no tiene
// módulo de voz.
export interface TenantVoz {
  assistantId: string;
}

// --- Simulación de bandeja en vivo (el interruptor "En vivo" del demo) ---
// Con el interruptor encendido, el motor inyecta mensajes en el navegador para
// que la bandeja se vea con movimiento al grabar. El guion es de cada cliente:
// al hotel le preguntan por tarifas y check in, a la inmobiliaria por metros y
// financiamiento. El motor no sabe de rubros, solo lee esto.
export type CanalExterno = Exclude<Channel, "internal">;

export interface TurnoSimulado {
  entra: string; // lo que escribe el cliente
  responde: string; // lo que contesta el agente de IA, sin llamar al modelo
}

// Contacto que abre una conversación nueva durante la simulación.
export interface ContactoSimulado {
  nombre: string;
  canal: CanalExterno;
  telefono?: string; // WhatsApp
  handle?: string; // Messenger e Instagram
  departamento?: DepartmentId; // si falta, el defaultDepartment del tenant
}

export interface TenantSimulacion {
  turnos: TurnoSimulado[];
  contactos: ContactoSimulado[];
}

export interface TenantConfig {
  id: TenantId;
  brand: TenantBrand;
  labels: TenantLabels;
  // Etiquetas de los roles (los ids internos no cambian entre tenants).
  roles: Record<RoleId, string>;
  // Departamento por defecto de una conversación de WhatsApp nueva.
  defaultDepartment: DepartmentId;
  // Etiquetas de contacto (interés/estado). La IA clasifica el interés en una de
  // estas al escribir el cliente; también se filtran en la pestaña Contactos.
  // Son propias de cada cliente (autos para Grupo Q, servicios para el hospital).
  tags: string[];
  seed: TenantSeed;
  // Guion de la bandeja en vivo del demo (solo simulación en el navegador).
  simulacion: TenantSimulacion;
  ai: { systemPrompt: string };
  dashboard: DashboardCard[];
  // Plantillas de WhatsApp demo (modo FAKE, sin credenciales). En modo real se
  // listan desde la WABA del cliente.
  waTemplates: WaTemplate[];
  whatsapp?: TenantWhatsApp;
  voz?: TenantVoz;
}
