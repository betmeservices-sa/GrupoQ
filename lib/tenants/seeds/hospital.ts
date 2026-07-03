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
  contacts: [
    { id: "c1", nombre: "María Elena Vásquez", telefono: "+503 7123 4567", canal: "whatsapp", notas: "Control prenatal, 28 semanas." },
    { id: "c2", nombre: "Karla Patricia Romero", telefono: "+503 7890 1122", canal: "whatsapp" },
    { id: "c3", nombre: "Wendy Alvarado", handle: "@wendy.alv", canal: "instagram" },
    { id: "c4", nombre: "Gloria Esperanza Mejía", telefono: "+503 7654 3210", canal: "whatsapp", notas: "Primera consulta." },
    { id: "c5", nombre: "Andrea Sosa", handle: "Andrea Sosa", canal: "facebook" },
    { id: "c6", nombre: "Fátima Beatriz Linares", telefono: "+503 7234 5566", canal: "whatsapp", notas: "Pareja en tratamiento de fertilidad." },
    { id: "c7", nombre: "Claudia Reyes", handle: "@clau.reyes", canal: "instagram" },
    { id: "c8", nombre: "Rosa Amelia Campos", telefono: "+503 7445 8899", canal: "whatsapp" },
    { id: "c9", nombre: "Daniela Quintanilla", telefono: "+503 7011 2233", canal: "whatsapp", notas: "Resultados de laboratorio pendientes." },
    { id: "c10", nombre: "Stephanie Gómez", handle: "Stephanie Gómez", canal: "facebook" },
    { id: "c11", nombre: "Ingrid Carolina Flores", telefono: "+503 7322 1144", canal: "whatsapp" },
    { id: "c12", nombre: "Norma Lisseth Aguilar", telefono: "+503 7588 9900", canal: "whatsapp", notas: "Control de bebé de 6 meses." },
    { id: "c13", nombre: "Jacqueline Moreno", handle: "@jacky.m", canal: "instagram" },
    { id: "c14", nombre: "Brenda Carolina Díaz", telefono: "+503 7099 4455", canal: "whatsapp" },
  ],
  conversations: [
    { id: "v1", canal: "whatsapp", contactId: "c1", departamento: "obstetricia", estado: "en_progreso", asignadoA: "s3", noLeidos: 0, ultimoMensajeTs: "2026-06-23T09:42:00" },
    { id: "v2", canal: "whatsapp", contactId: "c2", departamento: "ginecologia", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-06-23T10:18:00" },
    { id: "v3", canal: "instagram", contactId: "c3", departamento: "recepcion", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:05:00" },
    { id: "v4", canal: "whatsapp", contactId: "c4", departamento: "ginecologia", estado: "nuevo", noLeidos: 3, ultimoMensajeTs: "2026-06-23T10:31:00" },
    { id: "v5", canal: "facebook", contactId: "c5", departamento: "recepcion", estado: "en_progreso", asignadoA: ME, noLeidos: 0, ultimoMensajeTs: "2026-06-23T09:15:00" },
    { id: "v6", canal: "whatsapp", contactId: "c6", departamento: "reproduccion", estado: "en_progreso", asignadoA: "s5", noLeidos: 1, ultimoMensajeTs: "2026-06-23T08:58:00" },
    { id: "v7", canal: "instagram", contactId: "c7", departamento: "pediatria", estado: "resuelto", asignadoA: "s4", noLeidos: 0, ultimoMensajeTs: "2026-06-22T16:40:00" },
    { id: "v8", canal: "whatsapp", contactId: "c8", departamento: "laboratorio", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:22:00" },
    { id: "v9", canal: "whatsapp", contactId: "c9", departamento: "laboratorio", estado: "en_progreso", asignadoA: "s6", noLeidos: 0, ultimoMensajeTs: "2026-06-23T09:05:00" },
    { id: "v10", canal: "facebook", contactId: "c10", departamento: "imagenes", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-06-23T10:12:00" },
    { id: "v11", canal: "whatsapp", contactId: "c11", departamento: "ginecologia", estado: "resuelto", asignadoA: "s2", noLeidos: 0, ultimoMensajeTs: "2026-06-22T15:20:00" },
    { id: "v12", canal: "whatsapp", contactId: "c12", departamento: "pediatria", estado: "en_progreso", asignadoA: "s10", noLeidos: 0, ultimoMensajeTs: "2026-06-23T08:30:00" },
    { id: "v13", canal: "instagram", contactId: "c13", departamento: "recepcion", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:27:00" },
    { id: "v14", canal: "whatsapp", contactId: "c14", departamento: "obstetricia", estado: "resuelto", asignadoA: "s3", noLeidos: 0, ultimoMensajeTs: "2026-06-21T11:00:00" },
  ],
  messages: [
    // v1 - control prenatal
    { id: "m1", conversationId: "v1", autor: "cliente", texto: "Buenos días, quería confirmar mi cita de control prenatal para esta semana.", ts: "2026-06-23T09:30:00" },
    { id: "m2", conversationId: "v1", autor: "staff", staffId: "s3", texto: "Buenos días María Elena, claro que sí. Su cita es el jueves a las 10:00 am con el Dr. Portillo.", ts: "2026-06-23T09:36:00" },
    { id: "m3", conversationId: "v1", autor: "cliente", texto: "Perfecto, muchas gracias. ¿Debo llevar algún examen?", ts: "2026-06-23T09:40:00" },
    { id: "m4", conversationId: "v1", autor: "staff", staffId: "s3", texto: "Traiga su última ecografía y los resultados de hematología. La esperamos.", ts: "2026-06-23T09:42:00" },
    // v2 - costos consulta gineco (nuevo, sin asignar)
    { id: "m5", conversationId: "v2", autor: "cliente", texto: "Hola, buen día. ¿Cuánto cuesta la consulta con ginecólogo?", ts: "2026-06-23T10:14:00" },
    { id: "m6", conversationId: "v2", autor: "cliente", texto: "Y si atienden los sábados también?", ts: "2026-06-23T10:18:00" },
    // v3 - IG, info general
    { id: "m7", conversationId: "v3", autor: "cliente", texto: "Hola! Vi su publicación sobre el paquete de control de embarazo, me pueden dar más info?", ts: "2026-06-23T10:05:00" },
    // v4 - primera consulta (nuevo, 3 sin leer)
    { id: "m8", conversationId: "v4", autor: "cliente", texto: "Buenas, necesito una cita lo antes posible.", ts: "2026-06-23T10:25:00" },
    { id: "m9", conversationId: "v4", autor: "cliente", texto: "Tengo unos dolores y me preocupa.", ts: "2026-06-23T10:28:00" },
    { id: "m10", conversationId: "v4", autor: "cliente", texto: "Estoy disponible toda la tarde.", ts: "2026-06-23T10:31:00" },
    // v5 - facebook, asignada a mi
    { id: "m11", conversationId: "v5", autor: "cliente", texto: "Buenas tardes, ¿tienen estacionamiento en el hospital?", ts: "2026-06-23T09:05:00" },
    { id: "m12", conversationId: "v5", autor: "staff", staffId: "me", texto: "Buenas tardes Andrea, sí, contamos con estacionamiento propio para pacientes. Con gusto la esperamos.", ts: "2026-06-23T09:15:00" },
    // v6 - reproduccion asistida
    { id: "m13", conversationId: "v6", autor: "cliente", texto: "Doctor, ya tenemos los resultados de mi esposo. ¿Cuándo podemos pasar a consulta?", ts: "2026-06-23T08:50:00" },
    { id: "m14", conversationId: "v6", autor: "staff", staffId: "s5", texto: "Excelente Fátima. Pueden venir el lunes a las 3:00 pm para revisar todo juntos.", ts: "2026-06-23T08:55:00" },
    { id: "m15", conversationId: "v6", autor: "cliente", texto: "Gracias doctor, ahí estaremos.", ts: "2026-06-23T08:58:00" },
    // v7 - pediatria, resuelto
    { id: "m16", conversationId: "v7", autor: "cliente", texto: "Buenas, mi bebé tiene 3 meses, cuándo le toca la siguiente vacuna?", ts: "2026-06-22T16:20:00" },
    { id: "m17", conversationId: "v7", autor: "staff", staffId: "s4", texto: "Hola Claudia, a los 4 meses le corresponde la segunda dosis. Le agendo para la otra semana.", ts: "2026-06-22T16:35:00" },
    { id: "m18", conversationId: "v7", autor: "cliente", texto: "Perfecto, mil gracias!", ts: "2026-06-22T16:40:00" },
    // v8 - laboratorio (nuevo)
    { id: "m19", conversationId: "v8", autor: "cliente", texto: "Buenos días, ¿necesito cita para hacerme exámenes de sangre o llego directo?", ts: "2026-06-23T10:22:00" },
    // v9 - laboratorio en progreso
    { id: "m20", conversationId: "v9", autor: "cliente", texto: "Buen día, ya están listos mis resultados?", ts: "2026-06-23T08:55:00" },
    { id: "m21", conversationId: "v9", autor: "staff", staffId: "s6", texto: "Buen día Daniela, sus resultados estarán listos hoy después de las 2:00 pm. Se los enviamos por este medio.", ts: "2026-06-23T09:05:00" },
    // v10 - imagenes (facebook, nuevo)
    { id: "m22", conversationId: "v10", autor: "cliente", texto: "Hola, quiero info sobre el ultrasonido 4D, cuánto cuesta?", ts: "2026-06-23T10:08:00" },
    { id: "m23", conversationId: "v10", autor: "cliente", texto: "Y a partir de cuántas semanas se recomienda?", ts: "2026-06-23T10:12:00" },
    // v11 - gineco resuelto
    { id: "m24", conversationId: "v11", autor: "cliente", texto: "Doctora, gracias por la atención de ayer. Ya me siento mejor con el tratamiento.", ts: "2026-06-22T15:10:00" },
    { id: "m25", conversationId: "v11", autor: "staff", staffId: "s2", texto: "Me alegra mucho Ingrid. Cualquier cosa me escribe. Cuídese.", ts: "2026-06-22T15:20:00" },
    // v12 - pediatria control 6 meses
    { id: "m26", conversationId: "v12", autor: "cliente", texto: "Buenos días doctor, el bebé ya cumplió 6 meses, toca su control de crecimiento verdad?", ts: "2026-06-23T08:20:00" },
    { id: "m27", conversationId: "v12", autor: "staff", staffId: "s10", texto: "Así es Norma. Le agendo el control para el viernes a las 9:00 am.", ts: "2026-06-23T08:30:00" },
    // v13 - IG nuevo
    { id: "m28", conversationId: "v13", autor: "cliente", texto: "Buenas, atienden con seguro médico? Tengo SISA.", ts: "2026-06-23T10:27:00" },
    // v14 - obstetricia resuelto
    { id: "m29", conversationId: "v14", autor: "cliente", texto: "Doctor muchas gracias, todo salió bien con el parto. Bendiciones.", ts: "2026-06-21T10:50:00" },
    { id: "m30", conversationId: "v14", autor: "staff", staffId: "s3", texto: "Felicidades a la familia Brenda. Nos vemos en el control posparto. Un abrazo.", ts: "2026-06-21T11:00:00" },
  ],
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
