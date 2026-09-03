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
  | "promerica"
  | "yaly";

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
  logoComponent?: "promerica" | "yali";
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
  // Número tal como lo marca un cliente, con código de país. Es el que se usa
  // para armar los links `wa.me` que el negocio pone en la bio de cada perfil
  // (ver lib/origen-sede.ts). No es el phoneNumberId, que es un id interno.
  numeroPublico?: string;
}

// Agente de voz del tenant. La cuenta de voz es UNA sola y tiene agentes de
// varios clientes mezclados, así que este id es la frontera: un cliente solo ve
// (y solo puede marcar con) SU agente. Sin este bloque, el tenant no tiene
// módulo de voz.
export interface TenantVoz {
  /** El agente principal: el que marca por defecto y el que responde entrante. */
  assistantId: string;
  /**
   * Otros agentes del MISMO cliente. Un concesionario puede tener el de ventas
   * y el de cobros, que son guiones y voces distintas pero la misma empresa.
   * Todos entran en la frontera del tenant: se ven y se pueden usar, y ninguno
   * de otro cliente se cuela.
   */
  assistantIdsExtra?: string[];
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

// --- Sucursales: pregunta obligatoria de apertura ---
// Un tenant con varias sedes no puede contestar nada útil sin saber a cuál le
// escriben. Cuando el tenant declara `sucursales`, el PRIMER mensaje del agente
// es siempre esta pregunta, y se manda SIN llamar al modelo (cuesta 0 tokens).
// Recién con la sucursal identificada arranca la conversación con la IA.
export interface SucursalTenant {
  id: string; // llave estable con la que se guarda la elección (no cambiarla)
  nombre: string; // como se le muestra al huésped
  letra: string; // atajo para responder ("A", "B", "C")
  alias: string[]; // formas en que el huésped la puede escribir (en minúsculas, sin acentos)
}

export interface TenantSucursales {
  pregunta: string; // primer mensaje, textual
  reintento: string; // reformulación cuando no se entendió la respuesta
  maxReintentos: number; // cuántas veces se reformula antes de pasar a una persona
  handoff: string; // mensaje final si nunca se identificó la sucursal
  opciones: SucursalTenant[];
}

// --- Agente de IA del tenant ---
export interface TenantAi {
  systemPrompt: string;
  /** Cómo se llama el agente ("Sofía"). Se pinta en la bandeja como "Sofía (IA)". */
  nombre?: string;
  // Tope DURO de mensajes que el agente manda en una conversación. Al llegar,
  // se envía un cierre y el chat pasa a una persona. Default: LIMITE_MENSAJES_IA_DEFAULT.
  limiteMensajes?: number;
  // Si el agente puede VER las imágenes que le mandan por WhatsApp. Cuesta
  // tokens de entrada, y el guion del tenant tiene que decirlo (los guiones que
  // hoy dicen "no puedo abrir archivos" seguirían mintiendo). Default: false.
  imagenes?: boolean;
  // Si las notas de voz se pasan a texto antes de que el agente las lea
  // (lib/transcribir.ts, con la Gemini API). Vale lo mismo que `imagenes`: el
  // guion del tenant tiene que decir que SÍ escucha, o se contradice cuando le
  // manden un audio. Default: false, y sin GEMINI_API_KEY tampoco corre.
  // Nota: las notas de voz NUNCA las atiende el agente. Se probó pasarlas a
  // texto y el problema no fue que fallara, fue que al fallar a medias nadie se
  // enteraba. Ahora un audio apaga al agente en ese chat y se lo pasa a una
  // persona (lib/pasar-a-persona.ts).
  /**
   * Nombres propios que la transcripción tiene que escribir bien: habitaciones,
   * playas, municipios. Sin esto, un modelo que nunca oyó hablar del cliente
   * escribe lo que le suena ("Jalip Playel Sunsal" por "Yalí, Playa El Sunzal")
   * y después nadie reconoce de qué hotel hablan. Los nombres de las sedes se
   * agregan solos, no hace falta repetirlos acá.
   */
  vocabulario?: string[];
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
  ai: TenantAi;
  // Sedes del cliente. Si está, el agente pregunta por la sucursal ANTES de
  // cualquier otra cosa (ver lib/sucursal-gate.ts).
  sucursales?: TenantSucursales;
  dashboard: DashboardCard[];
  // Plantillas de WhatsApp demo (modo FAKE, sin credenciales). En modo real se
  // listan desde la WABA del cliente.
  waTemplates: WaTemplate[];
  whatsapp?: TenantWhatsApp;
  voz?: TenantVoz;
}
