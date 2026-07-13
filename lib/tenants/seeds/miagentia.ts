// Datos semilla de MiAgentIA (tenant "miagentia"), agencia de agentes de IA
// (voz + WhatsApp) para negocios. Este es el dashboard propio de la agencia:
// sirve para demos a prospectos y para probar la conexión REAL con Meta.
// Timestamps fijos (sin Date.now) para un demo estable.

import type { TenantSeed } from "../types";

const ME = "me";

export const miagentiaSeed: TenantSeed = {
  ME,
  departments: [
    { id: "ventas", nombre: "Ventas", color: "#7c3aed" },
    { id: "soporte", nombre: "Soporte", color: "#0e7490" },
    { id: "onboarding", nombre: "Onboarding", color: "#2e9e5b" },
    { id: "atencion", nombre: "Atención al Cliente", color: "#64748b" },
  ],
  staff: [
    { id: ME, nombre: "Gerente de Marketing", rol: "gerente_marketing", departamento: "atencion", iniciales: "GM" },
    { id: "s2", nombre: "Diana Escobar", rol: "medico", departamento: "ventas", iniciales: "DE" },
    { id: "s3", nombre: "Kevin Menjívar", rol: "medico", departamento: "soporte", iniciales: "KM" },
    { id: "s4", nombre: "Paola Linares", rol: "jefe", departamento: "ventas", iniciales: "PL" },
    { id: "s5", nombre: "Óscar Molina", rol: "medico", departamento: "onboarding", iniciales: "OM" },
    { id: "s6", nombre: "Tatiana Flores", rol: "recepcion", departamento: "atencion", iniciales: "TF" },
  ],
  contacts: [
    { id: "c1", nombre: "Ricardo Peña", handle: "@clinicadentalpena", canal: "instagram", notas: "Dueño de clínica dental. Lead del anuncio de agentes de WhatsApp." },
    { id: "c2", nombre: "Lorena Castro", handle: "Lorena Castro", canal: "facebook", notas: "Restaurante con 3 sucursales. Quiere demo del agente de voz." },
    { id: "c3", nombre: "Marvin Ayala", handle: "@ferreteria.ayala", canal: "instagram" },
    { id: "c4", nombre: "Beatriz Quintanilla", handle: "Beatriz Quintanilla", canal: "facebook" },
    { id: "c5", nombre: "Néstor Ramos", handle: "@academia.ramos", canal: "instagram", notas: "Academia de inglés. Pregunta si el agente agenda clases de prueba." },
  ],
  conversations: [
    { id: "v1", canal: "instagram", contactId: "c1", departamento: "ventas", estado: "en_progreso", asignadoA: "s2", noLeidos: 0, ultimoMensajeTs: "2026-06-23T10:20:00" },
    { id: "v2", canal: "facebook", contactId: "c2", departamento: "ventas", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-06-23T10:12:00" },
    { id: "v3", canal: "instagram", contactId: "c3", departamento: "soporte", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:27:00" },
    { id: "v4", canal: "facebook", contactId: "c4", departamento: "atencion", estado: "resuelto", asignadoA: ME, noLeidos: 0, ultimoMensajeTs: "2026-06-23T09:15:00" },
    { id: "v5", canal: "instagram", contactId: "c5", departamento: "onboarding", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:31:00" },
  ],
  messages: [
    // v1 - IG, clínica dental interesada en agente de WhatsApp (en progreso)
    { id: "m1", conversationId: "v1", autor: "cliente", texto: "Hola, vi su anuncio del agente de IA para WhatsApp. ¿Funciona para una clínica dental?", ts: "2026-06-23T10:05:00" },
    { id: "m2", conversationId: "v1", autor: "staff", staffId: "s2", texto: "Hola Ricardo, claro que sí. El agente responde a sus pacientes, agenda citas y envía recordatorios. ¿Le gustaría verlo en una demo de 15 minutos?", ts: "2026-06-23T10:12:00" },
    { id: "m3", conversationId: "v1", autor: "cliente", texto: "Sí me interesa. ¿Qué días tienen disponibles?", ts: "2026-06-23T10:20:00" },
    // v2 - FB, restaurante quiere agente de voz (nuevo, 2 sin leer)
    { id: "m4", conversationId: "v2", autor: "cliente", texto: "Buenas, quiero una demo del agente de voz para tomar reservas por teléfono.", ts: "2026-06-23T10:08:00" },
    { id: "m5", conversationId: "v2", autor: "cliente", texto: "Tenemos 3 sucursales, ¿el mismo agente atiende las 3?", ts: "2026-06-23T10:12:00" },
    // v3 - IG, cliente actual con duda de soporte (nuevo)
    { id: "m6", conversationId: "v3", autor: "cliente", texto: "Hola, ¿cómo agrego una nueva pregunta frecuente a mi agente?", ts: "2026-06-23T10:27:00" },
    // v4 - FB, consulta de precios (resuelto)
    { id: "m7", conversationId: "v4", autor: "cliente", texto: "Buenas tardes, ¿los planes incluyen el número de WhatsApp o lo pongo yo?", ts: "2026-06-23T09:05:00" },
    { id: "m8", conversationId: "v4", autor: "staff", staffId: "me", texto: "Buenas tardes Beatriz, puede usar su número actual de WhatsApp Business, nosotros lo conectamos sin que pierda sus chats. Con gusto le agendamos una llamada para los detalles.", ts: "2026-06-23T09:15:00" },
    // v5 - IG, academia en onboarding (nuevo)
    { id: "m9", conversationId: "v5", autor: "cliente", texto: "Hola, ya firmamos ayer. ¿Qué necesitan de mi parte para configurar el agente que agenda clases de prueba?", ts: "2026-06-23T10:31:00" },
  ],
  internalChannels: [
    { id: "ic1", nombre: "general", tipo: "canal", miembros: [ME, "s2", "s3", "s4", "s5", "s6"] },
    { id: "ic2", nombre: "ventas", tipo: "canal", miembros: [ME, "s2", "s4"] },
    { id: "ic3", nombre: "soporte", tipo: "canal", miembros: ["s3", "s5"] },
    { id: "ic4", nombre: "lanzamientos", tipo: "canal", miembros: [ME, "s2", "s4", "s5"] },
    { id: "dm1", nombre: "Paola Linares", tipo: "dm", miembros: [ME, "s4"] },
    { id: "dm2", nombre: "Kevin Menjívar", tipo: "dm", miembros: [ME, "s3"] },
  ],
  internalMessages: [
    { id: "im1", channelId: "ic1", staffId: "s4", texto: "Buenos días equipo. Esta semana lanzamos la campaña de agentes de voz, atentos a los leads de Facebook.", ts: "2026-06-23T08:00:00" },
    { id: "im2", channelId: "ic1", staffId: "s6", texto: "Anotado. Ya entraron 5 conversaciones nuevas del anuncio de esta mañana.", ts: "2026-06-23T08:12:00" },
    { id: "im3", channelId: "ic1", staffId: ME, texto: "Perfecto. Prioridad a los que piden demo: la meta es agendarla el mismo día.", ts: "2026-06-23T08:20:00" },
    { id: "im4", channelId: "ic2", staffId: "s2", texto: "Paola, el de la clínica dental quiere demo esta semana. ¿Me confirmas un espacio el jueves?", ts: "2026-06-23T09:10:00" },
    { id: "im5", channelId: "ic2", staffId: "s4", texto: "Jueves 10 am confirmado. Prepara la demo con el flujo de citas.", ts: "2026-06-23T09:18:00" },
    { id: "im6", channelId: "ic4", staffId: "s5", texto: "El agente de la academia queda en pruebas hoy. Mañana pasa a producción si el cliente aprueba.", ts: "2026-06-23T07:45:00" },
    { id: "im7", channelId: "dm1", staffId: "s4", texto: "¿Me pasas el reporte de conversaciones de la semana para la reunión?", ts: "2026-06-23T09:50:00" },
    { id: "im8", channelId: "dm1", staffId: ME, texto: "Claro Paola, se lo envío antes del mediodía.", ts: "2026-06-23T09:55:00" },
  ],
  socialPosts: [
    { id: "sp1", red: "instagram", estado: "publicado", texto: "Tu negocio responde en segundos, incluso a las 11 de la noche. Así trabaja un agente de IA en WhatsApp. Agenda tu demo gratis.", fecha: "2026-06-22T09:00:00", engagement: { alcance: 8400, meGusta: 512, comentarios: 34, compartidos: 41, guardados: 129 } },
    { id: "sp2", red: "facebook", estado: "publicado", texto: "¿Cuántas llamadas pierde tu negocio al día? Nuestro agente de voz contesta todas, toma reservas y agenda citas. Escríbenos.", fecha: "2026-06-21T15:00:00", engagement: { alcance: 12600, meGusta: 448, comentarios: 57, compartidos: 92 } },
    { id: "sp3", red: "instagram", estado: "programado", texto: "Caso real: una clínica pasó de responder en 4 horas a responder en 10 segundos. Te contamos cómo en este carrusel.", fecha: "2026-06-24T10:00:00" },
    { id: "sp4", red: "facebook", estado: "programado", texto: "Tu recepcionista de IA atiende WhatsApp, Instagram y llamadas al mismo tiempo. Pide tu demo por mensaje directo.", fecha: "2026-06-25T08:00:00" },
    { id: "sp5", red: "instagram", estado: "borrador", texto: "5 señales de que tu negocio necesita un agente de IA. La número 3 le pasa a casi todos.", fecha: "2026-06-23T12:00:00" },
  ],
  socialStats: [
    { red: "instagram", handle: "@miagentia", seguidores: 4800, nuevosSeguidores: 260, crecimientoPct: 5.7, alcance30d: 21400, vistas30d: 46800, interacciones30d: 2980 },
    { red: "facebook", handle: "MiAgentIA", seguidores: 9200, nuevosSeguidores: 410, crecimientoPct: 4.6, alcance30d: 38200, vistas30d: 71500, interacciones30d: 4310 },
  ],
  metrics: [
    { label: "Conversaciones hoy", valor: 18, delta: 22 },
    { label: "Leads de anuncios", valor: 11, delta: 38 },
    { label: "Tiempo de respuesta", valor: "2 min", delta: -35 },
    { label: "Tiempo medio de atención", valor: "6 min", delta: -12 },
    { label: "CSAT", valor: "4.8 / 5", delta: 3 },
    { label: "Atendidas por IA", valor: "78%", delta: 15 },
  ],
};
