// Datos semilla del Hospital Centro Ginecológico (tenant "hospital").
// Español salvadoreño. Timestamps fijos (sin Date.now) para un demo estable.
// Nota: el discriminante `autor` es canónico ("cliente"); la palabra visible
// ("paciente") sale de tenant.labels.contacto.

import type { TenantSeed } from "../types";

const ME = "me";

export const hospitalSeed: TenantSeed = {
  ME,
  departments: [
    { id: "ginecologia", nombre: "Ginecología", color: "#0067f8" },
    { id: "obstetricia", nombre: "Obstetricia", color: "#e84d8a" },
    { id: "pediatria", nombre: "Pediatría", color: "#4ac12f" },
    { id: "reproduccion", nombre: "Reproducción Asistida", color: "#9b51e0" },
    { id: "laboratorio", nombre: "Laboratorio", color: "#f5a623" },
    { id: "imagenes", nombre: "Imágenes", color: "#00b8d4" },
    { id: "recepcion", nombre: "Recepción", color: "#64748b" },
  ],
  staff: [
    { id: ME, nombre: "Gabriela Méndez", rol: "admin", departamento: "recepcion", iniciales: "GM" },
    { id: "s2", nombre: "Dra. Ana Beatriz Rivas", rol: "medico", departamento: "ginecologia", iniciales: "AR" },
    { id: "s3", nombre: "Dr. Carlos Portillo", rol: "medico", departamento: "obstetricia", iniciales: "CP" },
    { id: "s4", nombre: "Dra. Sofía Henríquez", rol: "jefe", departamento: "pediatria", iniciales: "SH" },
    { id: "s5", nombre: "Dr. Mauricio Alfaro", rol: "medico", departamento: "reproduccion", iniciales: "MA" },
    { id: "s6", nombre: "Lic. Karla Cruz", rol: "recepcion", departamento: "laboratorio", iniciales: "KC" },
    { id: "s7", nombre: "Dra. Verónica Bonilla", rol: "jefe", departamento: "ginecologia", iniciales: "VB" },
    { id: "s8", nombre: "Lic. José Ramírez", rol: "recepcion", departamento: "recepcion", iniciales: "JR" },
    { id: "s9", nombre: "Dra. Marta Guevara", rol: "medico", departamento: "imagenes", iniciales: "MG" },
    { id: "s10", nombre: "Dr. Roberto Cáceres", rol: "medico", departamento: "pediatria", iniciales: "RC" },
  ],
  // Bandeja limpia: sin conversaciones de muestra. Los chats aparecen aquí
  // cuando llega un mensaje REAL de WhatsApp (webhook -> Supabase -> inbox).
  contacts: [],
  conversations: [],
  messages: [],
  internalChannels: [
    { id: "ic1", nombre: "general", tipo: "canal", miembros: [ME, "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"] },
    { id: "ic2", nombre: "ginecologia", tipo: "canal", miembros: [ME, "s2", "s7"] },
    { id: "ic3", nombre: "pediatria", tipo: "canal", miembros: ["s4", "s10"] },
    { id: "ic4", nombre: "laboratorio", tipo: "canal", miembros: ["s6", "s9"] },
    { id: "ic5", nombre: "emergencias", tipo: "canal", miembros: [ME, "s2", "s3", "s7"] },
    { id: "dm1", nombre: "Dra. Verónica Bonilla", tipo: "dm", miembros: [ME, "s7"] },
    { id: "dm2", nombre: "Dr. Carlos Portillo", tipo: "dm", miembros: [ME, "s3"] },
  ],
  internalMessages: [
    { id: "im1", channelId: "ic1", staffId: "s7", texto: "Buenos días equipo. Recuerden que hoy tenemos jornada de toma de citología por la tarde.", ts: "2026-06-23T08:00:00" },
    { id: "im2", channelId: "ic1", staffId: "s8", texto: "Anotado. Ya tenemos 12 pacientes agendadas para la jornada.", ts: "2026-06-23T08:12:00" },
    { id: "im3", channelId: "ic1", staffId: ME, texto: "Perfecto. Recepción coordina el orden de llegada para que no se sature la sala.", ts: "2026-06-23T08:20:00" },
    { id: "im4", channelId: "ic2", staffId: "s2", texto: "Veronica, ¿me confirmas si el quirófano 2 está libre el jueves a las 11?", ts: "2026-06-23T09:10:00" },
    { id: "im5", channelId: "ic2", staffId: "s7", texto: "Sí, está disponible. Te lo reservo para el procedimiento.", ts: "2026-06-23T09:18:00" },
    { id: "im6", channelId: "ic5", staffId: "s3", texto: "Ingreso una paciente de 32 semanas con contracciones. La estamos evaluando en sala.", ts: "2026-06-23T07:45:00" },
    { id: "im7", channelId: "ic5", staffId: "s7", texto: "Voy en camino para apoyar. Tengan lista la sala de monitoreo.", ts: "2026-06-23T07:48:00" },
    { id: "im8", channelId: "dm1", staffId: "s7", texto: "Gaby, ¿me pasas el reporte de conversaciones de la semana para la reunión?", ts: "2026-06-23T09:50:00" },
    { id: "im9", channelId: "dm1", staffId: ME, texto: "Claro doctora, se lo envío antes del mediodía.", ts: "2026-06-23T09:55:00" },
  ],
  socialPosts: [
    { id: "sp1", red: "instagram", estado: "publicado", texto: "Tu salud y la de tu bebé en las mejores manos. Agenda tu control prenatal con nuestras especialistas. Somos parte de tu vida.", fecha: "2026-06-22T09:00:00", engagement: { alcance: 8420, meGusta: 612, comentarios: 38, compartidos: 47, guardados: 121 } },
    { id: "sp2", red: "facebook", estado: "publicado", texto: "Contamos con emergencias ginecológicas y pediátricas las 24 horas del día. Tu tranquilidad es nuestra prioridad.", fecha: "2026-06-21T15:00:00", engagement: { alcance: 11200, meGusta: 540, comentarios: 64, compartidos: 132 } },
    { id: "sp3", red: "instagram", estado: "programado", texto: "Conoce nuestro Centro de Reproducción Asistida con tecnología de última generación. Agenda tu cita informativa.", fecha: "2026-06-24T10:00:00" },
    { id: "sp4", red: "facebook", estado: "programado", texto: "Jornada de ultrasonido 4D este fin de semana. Cupos limitados, reserva por mensaje directo.", fecha: "2026-06-25T08:00:00" },
    { id: "sp5", red: "instagram", estado: "borrador", texto: "5 señales de que es momento de visitar a tu ginecóloga. Te contamos en este carrusel.", fecha: "2026-06-23T12:00:00" },
  ],
  socialStats: [
    { red: "instagram", handle: "@hospitalcentroginecologico", seguidores: 18420, nuevosSeguidores: 574, crecimientoPct: 3.2, alcance30d: 42100, vistas30d: 96300, interacciones30d: 5840 },
    { red: "facebook", handle: "Hospital Centro Ginecológico", seguidores: 31250, nuevosSeguidores: 412, crecimientoPct: 1.4, alcance30d: 58700, vistas30d: 121400, interacciones30d: 7920 },
  ],
  metrics: [
    { label: "Conversaciones hoy", valor: 38, delta: 12 },
    { label: "Tiempo de respuesta", valor: "6 min", delta: -18 },
  ],
};
