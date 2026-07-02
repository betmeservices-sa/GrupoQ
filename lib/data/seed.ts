// Datos semilla realistas para el demo de Grupo Q (distribuidor automotriz).
// Español salvadoreño. Timestamps fijos (sin Date.now) para que el demo sea estable.

import type {
  Contact,
  Conversation,
  Department,
  InternalChannel,
  InternalMessage,
  Message,
  Metric,
  SocialPost,
  SocialStats,
  StaffUser,
} from "./types";

export const ME = "me";

export const departments: Department[] = [
  { id: "ventas", nombre: "Vehículos Nuevos", color: "#006cb7" },
  { id: "usados", nombre: "Active Motors", color: "#f5a623" },
  { id: "taller", nombre: "Taller de Servicio", color: "#a32923" },
  { id: "repuestos", nombre: "Repuestos", color: "#9b51e0" },
  { id: "pintura", nombre: "Centro de Pintura", color: "#2baab1" },
  { id: "crediq", nombre: "CrediQ", color: "#00c040" },
  { id: "atencion", nombre: "Atención al Cliente", color: "#64748b" },
];

export const staff: StaffUser[] = [
  { id: ME, nombre: "Gabriela Méndez", rol: "admin", departamento: "atencion", iniciales: "GM" },
  { id: "s2", nombre: "Ana Rivas", rol: "medico", departamento: "ventas", iniciales: "AR" },
  { id: "s3", nombre: "Carlos Portillo", rol: "medico", departamento: "taller", iniciales: "CP" },
  { id: "s4", nombre: "Silvia Henríquez", rol: "jefe", departamento: "ventas", iniciales: "SH" },
  { id: "s5", nombre: "Mauricio Alfaro", rol: "medico", departamento: "crediq", iniciales: "MA" },
  { id: "s6", nombre: "Karla Cruz", rol: "recepcion", departamento: "repuestos", iniciales: "KC" },
  { id: "s7", nombre: "Verónica Bonilla", rol: "jefe", departamento: "taller", iniciales: "VB" },
  { id: "s8", nombre: "José Ramírez", rol: "recepcion", departamento: "atencion", iniciales: "JR" },
  { id: "s9", nombre: "Marta Guevara", rol: "medico", departamento: "pintura", iniciales: "MG" },
  { id: "s10", nombre: "Roberto Cáceres", rol: "medico", departamento: "usados", iniciales: "RC" },
];

export const contacts: Contact[] = [
  { id: "c1", nombre: "Marvin Alvarenga", telefono: "+503 7123 4567", canal: "whatsapp", notas: "Hyundai Tucson 2024, servicio de 10,000 km." },
  { id: "c2", nombre: "Karla Patricia Romero", telefono: "+503 7890 1122", canal: "whatsapp" },
  { id: "c3", nombre: "Wendy Alvarado", handle: "@wendy.alv", canal: "instagram" },
  { id: "c4", nombre: "Óscar Mejía", telefono: "+503 7654 3210", canal: "whatsapp", notas: "Vehículo no enciende, posible batería." },
  { id: "c5", nombre: "Andrea Sosa", handle: "Andrea Sosa", canal: "facebook" },
  { id: "c6", nombre: "Fátima Linares", telefono: "+503 7234 5566", canal: "whatsapp", notas: "Solicitud de crédito CrediQ en trámite." },
  { id: "c7", nombre: "Claudia Reyes", handle: "@clau.reyes", canal: "instagram" },
  { id: "c8", nombre: "Rosa Campos", telefono: "+503 7445 8899", canal: "whatsapp" },
  { id: "c9", nombre: "Daniel Quintanilla", telefono: "+503 7011 2233", canal: "whatsapp", notas: "Vehículo en taller, esperando repuesto." },
  { id: "c10", nombre: "Stephanie Gómez", handle: "Stephanie Gómez", canal: "facebook" },
  { id: "c11", nombre: "Ingrid Flores", telefono: "+503 7322 1144", canal: "whatsapp" },
  { id: "c12", nombre: "Norman Aguilar", telefono: "+503 7588 9900", canal: "whatsapp", notas: "Busca pickup usada en Active Motors." },
  { id: "c13", nombre: "Jacqueline Moreno", handle: "@jacky.m", canal: "instagram" },
  { id: "c14", nombre: "Brenda Díaz", telefono: "+503 7099 4455", canal: "whatsapp" },
];

export const conversations: Conversation[] = [
  { id: "v1", canal: "whatsapp", contactId: "c1", departamento: "taller", estado: "en_progreso", asignadoA: "s3", noLeidos: 0, ultimoMensajeTs: "2026-06-23T09:42:00" },
  { id: "v2", canal: "whatsapp", contactId: "c2", departamento: "ventas", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-06-23T10:18:00" },
  { id: "v3", canal: "instagram", contactId: "c3", departamento: "atencion", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:05:00" },
  { id: "v4", canal: "whatsapp", contactId: "c4", departamento: "taller", estado: "nuevo", noLeidos: 3, ultimoMensajeTs: "2026-06-23T10:31:00" },
  { id: "v5", canal: "facebook", contactId: "c5", departamento: "atencion", estado: "en_progreso", asignadoA: ME, noLeidos: 0, ultimoMensajeTs: "2026-06-23T09:15:00" },
  { id: "v6", canal: "whatsapp", contactId: "c6", departamento: "crediq", estado: "en_progreso", asignadoA: "s5", noLeidos: 1, ultimoMensajeTs: "2026-06-23T08:58:00" },
  { id: "v7", canal: "instagram", contactId: "c7", departamento: "repuestos", estado: "resuelto", asignadoA: "s6", noLeidos: 0, ultimoMensajeTs: "2026-06-22T16:40:00" },
  { id: "v8", canal: "whatsapp", contactId: "c8", departamento: "pintura", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:22:00" },
  { id: "v9", canal: "whatsapp", contactId: "c9", departamento: "taller", estado: "en_progreso", asignadoA: "s7", noLeidos: 0, ultimoMensajeTs: "2026-06-23T09:05:00" },
  { id: "v10", canal: "facebook", contactId: "c10", departamento: "ventas", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-06-23T10:12:00" },
  { id: "v11", canal: "whatsapp", contactId: "c11", departamento: "ventas", estado: "resuelto", asignadoA: "s2", noLeidos: 0, ultimoMensajeTs: "2026-06-22T15:20:00" },
  { id: "v12", canal: "whatsapp", contactId: "c12", departamento: "usados", estado: "en_progreso", asignadoA: "s10", noLeidos: 0, ultimoMensajeTs: "2026-06-23T08:30:00" },
  { id: "v13", canal: "instagram", contactId: "c13", departamento: "usados", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:27:00" },
  { id: "v14", canal: "whatsapp", contactId: "c14", departamento: "ventas", estado: "resuelto", asignadoA: "s2", noLeidos: 0, ultimoMensajeTs: "2026-06-21T11:00:00" },
];

export const messages: Message[] = [
  // v1 - servicio de 10,000 km
  { id: "m1", conversationId: "v1", autor: "cliente", texto: "Buenos días, quería confirmar la cita de mi Tucson para el servicio de los 10,000 km.", ts: "2026-06-23T09:30:00" },
  { id: "m2", conversationId: "v1", autor: "staff", staffId: "s3", texto: "Buenos días Marvin, claro que sí. Su cita es el jueves a las 10:00 am en el Taller de Servicio.", ts: "2026-06-23T09:36:00" },
  { id: "m3", conversationId: "v1", autor: "cliente", texto: "Perfecto, muchas gracias. ¿Más o menos cuánto tiempo tardan?", ts: "2026-06-23T09:40:00" },
  { id: "m4", conversationId: "v1", autor: "staff", staffId: "s3", texto: "Entre 2 y 3 horas. Puede esperar en nuestra sala o le avisamos por este medio cuando esté listo.", ts: "2026-06-23T09:42:00" },

  // v2 - cotización vehículo nuevo (nuevo, sin asignar)
  { id: "m5", conversationId: "v2", autor: "cliente", texto: "Hola, buen día. ¿Me pueden cotizar el Chevrolet Onix?", ts: "2026-06-23T10:14:00" },
  { id: "m6", conversationId: "v2", autor: "cliente", texto: "Y si atienden los sábados también?", ts: "2026-06-23T10:18:00" },

  // v3 - IG, info de promoción
  { id: "m7", conversationId: "v3", autor: "cliente", texto: "Hola! Vi su publicación de la promo de GWM, me pueden dar más info?", ts: "2026-06-23T10:05:00" },

  // v4 - vehículo no enciende (nuevo, 3 sin leer)
  { id: "m8", conversationId: "v4", autor: "cliente", texto: "Buenas, mi carro no enciende desde ayer.", ts: "2026-06-23T10:25:00" },
  { id: "m9", conversationId: "v4", autor: "cliente", texto: "Creo que puede ser la batería.", ts: "2026-06-23T10:28:00" },
  { id: "m10", conversationId: "v4", autor: "cliente", texto: "¿Tienen servicio de grúa o me pueden mandar a alguien?", ts: "2026-06-23T10:31:00" },

  // v5 - facebook, asignada a mi
  { id: "m11", conversationId: "v5", autor: "cliente", texto: "Buenas tardes, ¿la sucursal tiene estacionamiento para clientes?", ts: "2026-06-23T09:05:00" },
  { id: "m12", conversationId: "v5", autor: "staff", staffId: "me", texto: "Buenas tardes Andrea, sí, contamos con estacionamiento propio para clientes. Con gusto la esperamos.", ts: "2026-06-23T09:15:00" },

  // v6 - crédito CrediQ
  { id: "m13", conversationId: "v6", autor: "cliente", texto: "Buen día, ya tenemos completos los papeles del crédito. ¿Cuándo podemos pasar?", ts: "2026-06-23T08:50:00" },
  { id: "m14", conversationId: "v6", autor: "staff", staffId: "s5", texto: "Excelente Fátima. Pueden venir el lunes a las 3:00 pm para revisar todo y firmar.", ts: "2026-06-23T08:55:00" },
  { id: "m15", conversationId: "v6", autor: "cliente", texto: "Gracias, ahí estaremos.", ts: "2026-06-23T08:58:00" },

  // v7 - repuestos, resuelto
  { id: "m16", conversationId: "v7", autor: "cliente", texto: "Buenas, ¿tienen el filtro de aceite original para Isuzu D-MAX 2022?", ts: "2026-06-22T16:20:00" },
  { id: "m17", conversationId: "v7", autor: "staff", staffId: "s6", texto: "Hola Claudia, sí lo tenemos en existencia. Se lo aparto en el mostrador de Repuestos a su nombre.", ts: "2026-06-22T16:35:00" },
  { id: "m18", conversationId: "v7", autor: "cliente", texto: "Perfecto, mil gracias!", ts: "2026-06-22T16:40:00" },

  // v8 - centro de pintura (nuevo)
  { id: "m19", conversationId: "v8", autor: "cliente", texto: "Buenos días, tuve un golpe leve en la puerta. ¿Necesito cita para el Centro de Pintura o llego directo?", ts: "2026-06-23T10:22:00" },

  // v9 - estado del vehículo en taller
  { id: "m20", conversationId: "v9", autor: "cliente", texto: "Buen día, ¿ya está listo mi vehículo?", ts: "2026-06-23T08:55:00" },
  { id: "m21", conversationId: "v9", autor: "staff", staffId: "s7", texto: "Buen día Daniel, el repuesto llegó hoy. Su vehículo estará listo hoy después de las 2:00 pm. Le avisamos por este medio.", ts: "2026-06-23T09:05:00" },

  // v10 - test drive (facebook, nuevo)
  { id: "m22", conversationId: "v10", autor: "cliente", texto: "Hola, quiero agendar un test drive del GWM Haval H6.", ts: "2026-06-23T10:08:00" },
  { id: "m23", conversationId: "v10", autor: "cliente", texto: "¿Qué requisitos piden?", ts: "2026-06-23T10:12:00" },

  // v11 - post venta, resuelto
  { id: "m24", conversationId: "v11", autor: "cliente", texto: "Gracias por la atención de ayer. El carro quedó excelente y el proceso fue bien rápido.", ts: "2026-06-22T15:10:00" },
  { id: "m25", conversationId: "v11", autor: "staff", staffId: "s2", texto: "Me alegra mucho Ingrid. Cualquier cosa me escribe. Que lo disfrute.", ts: "2026-06-22T15:20:00" },

  // v12 - seminuevos Active Motors
  { id: "m26", conversationId: "v12", autor: "cliente", texto: "Buenos días, ando buscando una pickup usada, de preferencia diésel. ¿Qué tienen disponible?", ts: "2026-06-23T08:20:00" },
  { id: "m27", conversationId: "v12", autor: "staff", staffId: "s10", texto: "Buenos días Norman. En Active Motors tenemos varias opciones certificadas. Le agendo una visita el viernes a las 9:00 am y se las muestro.", ts: "2026-06-23T08:30:00" },

  // v13 - IG nuevo
  { id: "m28", conversationId: "v13", autor: "cliente", texto: "Buenas, ¿aceptan mi vehículo actual como parte de pago por uno nuevo?", ts: "2026-06-23T10:27:00" },

  // v14 - entrega de vehículo, resuelto
  { id: "m29", conversationId: "v14", autor: "cliente", texto: "Muchas gracias, la entrega estuvo excelente. Toda la familia feliz con el carro nuevo.", ts: "2026-06-21T10:50:00" },
  { id: "m30", conversationId: "v14", autor: "staff", staffId: "s2", texto: "Felicidades Brenda. Bienvenida a la familia Grupo Q. Nos vemos en su primer servicio.", ts: "2026-06-21T11:00:00" },
];

export const internalChannels: InternalChannel[] = [
  { id: "ic1", nombre: "general", tipo: "canal", miembros: [ME, "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"] },
  { id: "ic2", nombre: "ventas", tipo: "canal", miembros: [ME, "s2", "s4", "s10"] },
  { id: "ic3", nombre: "taller", tipo: "canal", miembros: ["s3", "s7", "s9"] },
  { id: "ic4", nombre: "repuestos", tipo: "canal", miembros: ["s6", "s7"] },
  { id: "ic5", nombre: "entregas", tipo: "canal", miembros: [ME, "s2", "s3", "s4"] },
  { id: "dm1", nombre: "Verónica Bonilla", tipo: "dm", miembros: [ME, "s7"] },
  { id: "dm2", nombre: "Carlos Portillo", tipo: "dm", miembros: [ME, "s3"] },
];

export const internalMessages: InternalMessage[] = [
  // general
  { id: "im1", channelId: "ic1", staffId: "s4", texto: "Buenos días equipo. Recuerden que el sábado tenemos la feria de seminuevos en el patio principal.", ts: "2026-06-23T08:00:00" },
  { id: "im2", channelId: "ic1", staffId: "s8", texto: "Anotado. Ya tenemos 12 clientes confirmados para test drive.", ts: "2026-06-23T08:12:00" },
  { id: "im3", channelId: "ic1", staffId: ME, texto: "Perfecto. Atención al Cliente coordina el orden de llegada para que no se sature la sala.", ts: "2026-06-23T08:20:00" },
  // ventas
  { id: "im4", channelId: "ic2", staffId: "s2", texto: "Silvia, ¿me confirmas si queda Tucson gris en inventario para entrega inmediata?", ts: "2026-06-23T09:10:00" },
  { id: "im5", channelId: "ic2", staffId: "s4", texto: "Sí, queda una unidad. Te la reservo para tu cliente.", ts: "2026-06-23T09:18:00" },
  // entregas
  { id: "im6", channelId: "ic5", staffId: "s3", texto: "Ingresó un vehículo en grúa con falla eléctrica. Lo estamos evaluando en la bahía 1.", ts: "2026-06-23T07:45:00" },
  { id: "im7", channelId: "ic5", staffId: "s7", texto: "Voy en camino para apoyar. Tengan listo el escáner de diagnóstico.", ts: "2026-06-23T07:48:00" },
  // dm1
  { id: "im8", channelId: "dm1", staffId: "s7", texto: "Gaby, ¿me pasas el reporte de conversaciones de la semana para la reunión?", ts: "2026-06-23T09:50:00" },
  { id: "im9", channelId: "dm1", staffId: ME, texto: "Claro Verónica, se lo envío antes del mediodía.", ts: "2026-06-23T09:55:00" },
];

export const socialPosts: SocialPost[] = [
  { id: "sp1", red: "instagram", estado: "publicado", texto: "Tu próximo vehículo te está esperando. Agenda tu test drive hoy mismo. Vas a llegar.", fecha: "2026-06-22T09:00:00", engagement: { alcance: 8420, meGusta: 612, comentarios: 38, compartidos: 47, guardados: 121 } },
  { id: "sp2", red: "facebook", estado: "publicado", texto: "Nuestro Taller de Servicio cuenta con técnicos certificados y repuestos originales de fábrica. Tu vehículo en las mejores manos.", fecha: "2026-06-21T15:00:00", engagement: { alcance: 11200, meGusta: 540, comentarios: 64, compartidos: 132 } },
  { id: "sp3", red: "instagram", estado: "programado", texto: "Conoce Active Motors: seminuevos certificados con garantía y respaldo Grupo Q. Agenda tu visita.", fecha: "2026-06-24T10:00:00" },
  { id: "sp4", red: "facebook", estado: "programado", texto: "Feria de crédito con CrediQ este fin de semana. Cupos limitados, reserva por mensaje directo.", fecha: "2026-06-25T08:00:00" },
  { id: "sp5", red: "instagram", estado: "borrador", texto: "5 señales de que tu vehículo ya necesita servicio. Te contamos en este carrusel.", fecha: "2026-06-23T12:00:00" },
];

// Estadísticas de cuenta (mock) con la forma que devuelve Meta Graph API Insights.
export const socialStats: SocialStats[] = [
  {
    red: "instagram",
    handle: "@grupoq_centroamerica",
    seguidores: 18420,
    nuevosSeguidores: 574,
    crecimientoPct: 3.2,
    alcance30d: 42100,
    vistas30d: 96300,
    interacciones30d: 5840,
  },
  {
    red: "facebook",
    handle: "Grupo Q Centroamérica",
    seguidores: 31250,
    nuevosSeguidores: 412,
    crecimientoPct: 1.4,
    alcance30d: 58700,
    vistas30d: 121400,
    interacciones30d: 7920,
  },
];

export const metrics: Metric[] = [
  { label: "Conversaciones hoy", valor: 38, delta: 12 },
  { label: "Tiempo de respuesta promedio", valor: "6 min", delta: -18 },
  { label: "% resueltas", valor: "82%", delta: 5 },
  { label: "Sin asignar", valor: 6, delta: 0 },
];
