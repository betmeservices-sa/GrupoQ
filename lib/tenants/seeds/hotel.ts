// Datos semilla del tenant "hotel" (El Descanso Antigua, Antigua Guatemala).
// Son las conversaciones y el equipo de DEMOSTRACIÓN, igual que en los otros
// clientes. Lo que sí es real y se lee en vivo del PMS es la disponibilidad, las
// tarifas y las reservas: eso vive en lib/cloudbeds.ts, no aquí.
// Timestamps fijos (sin Date.now) para un demo estable.

import type { TenantSeed } from "../types";

const ME = "me";

export const hotelSeed: TenantSeed = {
  ME,
  departments: [
    { id: "reservas", nombre: "Reservas", color: "#0e7490" },
    { id: "recepcion", nombre: "Recepción", color: "#7c3aed" },
    { id: "conserjeria", nombre: "Conserjería", color: "#2e9e5b" },
    { id: "atencion", nombre: "Atención al Huésped", color: "#64748b" },
  ],
  staff: [
    { id: ME, nombre: "Gerente de Marketing", rol: "gerente_marketing", departamento: "atencion", iniciales: "GM" },
    { id: "s2", nombre: "Andrea Xicay", rol: "medico", departamento: "reservas", iniciales: "AX" },
    { id: "s3", nombre: "Julio Cutzal", rol: "recepcion", departamento: "recepcion", iniciales: "JC" },
    { id: "s4", nombre: "Marta Elena Ruiz", rol: "jefe", departamento: "reservas", iniciales: "MR" },
    { id: "s5", nombre: "Diego Salazar", rol: "medico", departamento: "conserjeria", iniciales: "DS" },
    { id: "s6", nombre: "Wendy Chacón", rol: "recepcion", departamento: "atencion", iniciales: "WC" },
  ],
  contacts: [
    { id: "c1", nombre: "Paula Marroquín", telefono: "50255120988", canal: "whatsapp", notas: "Pregunta por una casa completa para fin de semana largo.", tags: ["Grupo o evento"] },
    { id: "c2", nombre: "Steven Clark", handle: "@stevenclark.travels", canal: "instagram", notas: "Viajero de Estados Unidos, 5 noches en octubre." },
    { id: "c3", nombre: "Rocío Herrera", telefono: "50241207766", canal: "whatsapp", tags: ["Consulta de disponibilidad"] },
    { id: "c4", nombre: "Familia Estrada", handle: "Familia Estrada", canal: "facebook", notas: "Aniversario, quieren traslado desde el aeropuerto." },
    { id: "c5", nombre: "Karen González", telefono: "50257881234", canal: "whatsapp", notas: "Se hospedó del 21 al 24 de julio. Quedó saldo pendiente.", tags: ["Reserva confirmada"] },
  ],
  conversations: [
    { id: "v1", canal: "whatsapp", contactId: "c1", departamento: "reservas", estado: "en_progreso", asignadoA: "s2", noLeidos: 0, ultimoMensajeTs: "2026-08-11T09:42:00" },
    { id: "v2", canal: "instagram", contactId: "c2", departamento: "reservas", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-08-11T09:20:00" },
    { id: "v3", canal: "whatsapp", contactId: "c3", departamento: "recepcion", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-08-11T09:55:00" },
    { id: "v4", canal: "facebook", contactId: "c4", departamento: "conserjeria", estado: "en_progreso", asignadoA: "s5", noLeidos: 0, ultimoMensajeTs: "2026-08-11T08:30:00" },
    { id: "v5", canal: "whatsapp", contactId: "c5", departamento: "atencion", estado: "resuelto", asignadoA: ME, noLeidos: 0, ultimoMensajeTs: "2026-08-10T16:05:00" },
  ],
  messages: [
    // v1 - casa completa para grupo
    { id: "m1", conversationId: "v1", autor: "cliente", texto: "Buenos días, ¿tienen una casa completa para 8 personas el próximo fin de semana?", ts: "2026-08-11T09:28:00" },
    { id: "m2", conversationId: "v1", autor: "staff", staffId: "s2", texto: "Buenos días Paula, sí tenemos disponible El Descanso 8, con 3 habitaciones y baño privado en cada una. ¿Para qué fechas exactas la necesita?", ts: "2026-08-11T09:36:00" },
    { id: "m3", conversationId: "v1", autor: "cliente", texto: "Del viernes al domingo. ¿Cuánto sale por noche?", ts: "2026-08-11T09:42:00" },
    // v2 - viajero extranjero (IG)
    { id: "m4", conversationId: "v2", autor: "cliente", texto: "Hola! ¿Tienen habitación para 2 personas en octubre?", ts: "2026-08-11T09:16:00" },
    { id: "m5", conversationId: "v2", autor: "cliente", texto: "Serían 5 noches, llegando el 10.", ts: "2026-08-11T09:20:00" },
    // v3 - consulta suelta
    { id: "m6", conversationId: "v3", autor: "cliente", texto: "Buenas, ¿a qué hora es el check in y tienen parqueo?", ts: "2026-08-11T09:55:00" },
    // v4 - aniversario con traslado
    { id: "m7", conversationId: "v4", autor: "cliente", texto: "Queremos celebrar nuestro aniversario allí. ¿Pueden recogernos en el aeropuerto?", ts: "2026-08-11T08:12:00" },
    { id: "m8", conversationId: "v4", autor: "staff", staffId: "s5", texto: "Con mucho gusto coordinamos el traslado. ¿Me confirma el día y la hora de su vuelo para dejarlo apartado?", ts: "2026-08-11T08:30:00" },
    // v5 - huésped que ya se fue
    { id: "m9", conversationId: "v5", autor: "cliente", texto: "Buenas tardes, quería agradecerles por la estadía. Todo excelente.", ts: "2026-08-10T15:52:00" },
    { id: "m10", conversationId: "v5", autor: "staff", staffId: "me", texto: "Muchas gracias Karen, fue un gusto recibirla. La esperamos pronto de vuelta en Antigua.", ts: "2026-08-10T16:05:00" },
  ],
  internalChannels: [
    { id: "ic1", nombre: "general", tipo: "canal", miembros: [ME, "s2", "s3", "s4", "s5", "s6"] },
    { id: "ic2", nombre: "reservas", tipo: "canal", miembros: [ME, "s2", "s4"] },
    { id: "ic3", nombre: "recepcion", tipo: "canal", miembros: ["s3", "s6"] },
    { id: "ic4", nombre: "mantenimiento", tipo: "canal", miembros: [ME, "s3", "s5"] },
    { id: "dm1", nombre: "Marta Elena Ruiz", tipo: "dm", miembros: [ME, "s4"] },
    { id: "dm2", nombre: "Julio Cutzal", tipo: "dm", miembros: [ME, "s3"] },
  ],
  internalMessages: [
    { id: "im1", channelId: "ic1", staffId: "s4", texto: "Buenos días. Recuerden que las casas grandes se cotizan por noche completa, no por persona.", ts: "2026-08-11T07:30:00" },
    { id: "im2", channelId: "ic1", staffId: "s6", texto: "Anotado. Van 4 consultas por WhatsApp desde anoche.", ts: "2026-08-11T07:44:00" },
    { id: "im3", channelId: "ic2", staffId: "s2", texto: "Marta, siguen sin tarifa las habitaciones de la Divina. No salen en disponibilidad y no las podemos vender.", ts: "2026-08-11T08:05:00" },
    { id: "im4", channelId: "ic2", staffId: "s4", texto: "Lo veo hoy con administración. Son 11 habitaciones paradas.", ts: "2026-08-11T08:14:00" },
    { id: "im5", channelId: "ic3", staffId: "s3", texto: "La 2 quedó lista desde las 11. Check in temprano sin problema.", ts: "2026-08-11T09:02:00" },
    { id: "im6", channelId: "ic4", staffId: "s5", texto: "Cambié el calentador de la Habitación 1. Ya quedó funcionando.", ts: "2026-08-10T17:20:00" },
    { id: "im7", channelId: "dm1", staffId: "s4", texto: "¿Me pasas el corte de ocupación de la quincena para la reunión?", ts: "2026-08-11T09:10:00" },
    { id: "im8", channelId: "dm1", staffId: ME, texto: "Claro Marta, se lo mando antes del mediodía.", ts: "2026-08-11T09:14:00" },
  ],
  socialPosts: [
    { id: "sp1", red: "instagram", estado: "publicado", texto: "Amanecer sobre el Volcán de Agua desde el patio. Antigua se siente distinto cuando te despiertas aquí.", fecha: "2026-08-09T07:30:00", engagement: { alcance: 9600, meGusta: 741, comentarios: 38, compartidos: 55, guardados: 212 } },
    { id: "sp2", red: "facebook", estado: "publicado", texto: "Casa completa para grupos, a diez minutos del Parque Central. Escríbenos y te contamos las fechas libres.", fecha: "2026-08-07T18:00:00", engagement: { alcance: 7300, meGusta: 288, comentarios: 24, compartidos: 31 } },
    { id: "sp3", red: "instagram", estado: "programado", texto: "Tres planes para un fin de semana en Antigua sin manejar: mercado, cerro y café de finca.", fecha: "2026-08-13T10:00:00" },
    { id: "sp4", red: "facebook", estado: "programado", texto: "Aniversario, cumpleaños o simple escapada: armamos el detalle en la habitación. Consúltanos por mensaje.", fecha: "2026-08-15T09:00:00" },
    { id: "sp5", red: "instagram", estado: "borrador", texto: "Lo que nadie te dice de hospedarte en el centro de Antigua durante la semana.", fecha: "2026-08-12T12:00:00" },
  ],
  socialStats: [
    { red: "instagram", handle: "@eldescansoantigua", seguidores: 6100, nuevosSeguidores: 340, crecimientoPct: 5.9, alcance30d: 48200, vistas30d: 91400, interacciones30d: 5240 },
    { red: "facebook", handle: "El Descanso Antigua", seguidores: 4400, nuevosSeguidores: 180, crecimientoPct: 4.3, alcance30d: 26800, vistas30d: 39100, interacciones30d: 2115 },
  ],
  metrics: [
    { label: "Conversaciones hoy", valor: 14, delta: 18 },
    { label: "Consultas de disponibilidad", valor: 9, delta: 25 },
    { label: "Tiempo de respuesta", valor: "1 min", delta: -42 },
    { label: "Tiempo medio de atención", valor: "5 min", delta: -15 },
    { label: "CSAT", valor: "4.9 / 5", delta: 2 },
    { label: "Atendidas por IA", valor: "81%", delta: 19 },
  ],
};
