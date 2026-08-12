// Datos semilla del tenant "inmobiliaria" (Terrazul Bienes Raíces, El Salvador).
// Conversaciones, equipo y redes de DEMOSTRACIÓN, igual que en los otros
// clientes. La cartera y los leads del pipeline viven aparte, en
// lib/inmobiliaria-datos.ts, porque los usan también las rutas de API.
// Las personas y los propietarios son inventados. Timestamps fijos para que el
// demo se vea igual siempre.

import type { TenantSeed } from "../types";

const ME = "me";

export const inmobiliariaSeed: TenantSeed = {
  ME,
  departments: [
    { id: "ventas", nombre: "Ventas", color: "#12507e" },
    { id: "captacion", nombre: "Captación", color: "#9a4d15" },
    { id: "legal", nombre: "Trámites", color: "#15653f" },
    { id: "atencion", nombre: "Atención al Cliente", color: "#55647a" },
  ],
  staff: [
    { id: ME, nombre: "Gerente Comercial", rol: "gerente_marketing", departamento: "atencion", iniciales: "GC" },
    { id: "s2", nombre: "Alejandra Portillo", rol: "medico", departamento: "ventas", iniciales: "AP" },
    { id: "s3", nombre: "Douglas Menjívar", rol: "medico", departamento: "ventas", iniciales: "DM" },
    { id: "s4", nombre: "Karla Bonilla", rol: "medico", departamento: "ventas", iniciales: "KB" },
    { id: "s5", nombre: "Rodrigo Escalante", rol: "jefe", departamento: "captacion", iniciales: "RE" },
    { id: "s6", nombre: "Fátima Argueta", rol: "recepcion", departamento: "atencion", iniciales: "FA" },
    { id: "s7", nombre: "Nadia Quintanilla", rol: "marketing", departamento: "legal", iniciales: "NQ" },
  ],
  contacts: [
    { id: "c1", nombre: "Wendy Carolina Ramos", telefono: "50378541209", canal: "whatsapp", notas: "Vio el anuncio de TZ-103 en Facebook.", tags: ["Compra de vivienda"] },
    { id: "c2", nombre: "Julio César Barahona", handle: "Julio Barahona", canal: "facebook", notas: "Busca en Merliot, va con crédito de banco.", tags: ["Compra de vivienda"] },
    { id: "c3", nombre: "Sandra Melgar de Ayala", telefono: "50372338814", canal: "whatsapp", notas: "Cotización del FSV lista, cuota aprobada.", tags: ["Compra de vivienda"] },
    { id: "c4", nombre: "Marielos Guzmán", handle: "@marielos.gzmn", canal: "instagram", tags: ["Compra de vivienda"] },
    { id: "c5", nombre: "Ernesto Sibrián", telefono: "50370125566", canal: "whatsapp", notas: "Paga de contado, vende otra propiedad.", tags: ["Inversión"] },
    { id: "c6", nombre: "Herman Portillo Guevara", telefono: "50371193358", canal: "whatsapp", notas: "Propietario del local del Paseo El Carmen.", tags: ["Vende su propiedad"] },
  ],
  conversations: [
    { id: "v1", canal: "whatsapp", contactId: "c1", departamento: "ventas", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-08-12T09:41:00" },
    { id: "v2", canal: "facebook", contactId: "c2", departamento: "ventas", estado: "en_progreso", asignadoA: "s3", noLeidos: 0, ultimoMensajeTs: "2026-08-12T09:12:00" },
    { id: "v3", canal: "whatsapp", contactId: "c3", departamento: "ventas", estado: "en_progreso", asignadoA: "s4", noLeidos: 0, ultimoMensajeTs: "2026-08-12T08:35:00" },
    { id: "v4", canal: "instagram", contactId: "c4", departamento: "ventas", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-08-11T18:20:00" },
    { id: "v5", canal: "whatsapp", contactId: "c5", departamento: "ventas", estado: "en_progreso", asignadoA: ME, noLeidos: 0, ultimoMensajeTs: "2026-08-11T16:04:00" },
    { id: "v6", canal: "whatsapp", contactId: "c6", departamento: "captacion", estado: "resuelto", asignadoA: "s5", noLeidos: 0, ultimoMensajeTs: "2026-08-10T15:30:00" },
  ],
  messages: [
    { id: "m1", conversationId: "v1", autor: "cliente", texto: "Buenos días, vi la casa de Santa Tecla de 198 mil. ¿Todavía está disponible?", ts: "2026-08-12T09:38:00" },
    { id: "m2", conversationId: "v1", autor: "cliente", texto: "¿Y aceptan crédito del banco?", ts: "2026-08-12T09:41:00" },

    { id: "m3", conversationId: "v2", autor: "cliente", texto: "Hola, ando buscando casa en Merliot, de tres cuartos.", ts: "2026-08-12T08:55:00" },
    { id: "m4", conversationId: "v2", autor: "staff", staffId: "s3", texto: "Buenos días Julio. Tengo una en Jardines de Merliot, 3 habitaciones y 2 baños, en 172,500. ¿Ya tiene aprobación del banco o la vemos primero?", ts: "2026-08-12T09:04:00" },
    { id: "m5", conversationId: "v2", autor: "cliente", texto: "Ya me aprobaron 185 mil en el banco. Me interesa verla el fin de semana.", ts: "2026-08-12T09:12:00" },

    { id: "m6", conversationId: "v3", autor: "cliente", texto: "Buenas, ya me salió la cotización del FSV. ¿La casa de Lourdes califica?", ts: "2026-08-12T08:22:00" },
    { id: "m7", conversationId: "v3", autor: "staff", staffId: "s4", texto: "Sí Sandra, esa está dentro del tope y la escritura ya está inscrita. ¿Le parece si la vemos el jueves por la mañana?", ts: "2026-08-12T08:35:00" },

    { id: "m8", conversationId: "v4", autor: "cliente", texto: "Hola! ¿Cuánto cuesta la casa que subieron ayer?", ts: "2026-08-11T18:20:00" },

    { id: "m9", conversationId: "v5", autor: "cliente", texto: "Ya vendí mi casa anterior, puedo pagar de contado. Quiero ver la de Escalón.", ts: "2026-08-11T15:48:00" },
    { id: "m10", conversationId: "v5", autor: "staff", staffId: ME, texto: "Excelente noticia, don Ernesto. Le aparto la visita para mañana a las 4 de la tarde y le mando la ubicación.", ts: "2026-08-11T16:04:00" },

    { id: "m11", conversationId: "v6", autor: "cliente", texto: "Quiero poner en venta mi local del Paseo El Carmen.", ts: "2026-08-10T14:50:00" },
    { id: "m12", conversationId: "v6", autor: "staff", staffId: "s5", texto: "Con gusto lo tomamos, don Herman. Ya quedó cargado como TZ-106 y esta semana pasamos a tomar las fotos.", ts: "2026-08-10T15:30:00" },
  ],
  internalChannels: [
    { id: "ic1", nombre: "general", tipo: "canal", miembros: [ME, "s2", "s3", "s4", "s5", "s6", "s7"] },
    { id: "ic2", nombre: "cartera", tipo: "canal", miembros: [ME, "s2", "s3", "s4", "s5"] },
    { id: "ic3", nombre: "tramites", tipo: "canal", miembros: [ME, "s7", "s4"] },
    { id: "dm1", nombre: "Rodrigo Escalante", tipo: "dm", miembros: [ME, "s5"] },
    { id: "dm2", nombre: "Karla Bonilla", tipo: "dm", miembros: [ME, "s4"] },
  ],
  internalMessages: [
    { id: "im1", channelId: "ic1", staffId: ME, texto: "Buenos días. Hoy revisamos los leads que llevan más de una semana sin contacto, están saliendo en rojo en el pipeline.", ts: "2026-08-12T07:30:00" },
    { id: "im2", channelId: "ic1", staffId: "s2", texto: "Anotado. Yo tengo dos de FSV que quedaron pendientes de papelería.", ts: "2026-08-12T07:41:00" },
    { id: "im3", channelId: "ic2", staffId: "s5", texto: "La TZ-103 está apartada desde el viernes y sigue publicada. Ya nos entraron tres consultas por ella.", ts: "2026-08-12T08:02:00" },
    { id: "im4", channelId: "ic2", staffId: ME, texto: "La bajo hoy mismo de portales y redes. Nadie agende visita a esa casa.", ts: "2026-08-12T08:06:00" },
    { id: "im5", channelId: "ic2", staffId: "s3", texto: "La exclusiva de Nuevo Cuscatlán venció. Hay que hablar con la propietaria antes de seguir pautando.", ts: "2026-08-12T08:20:00" },
    { id: "im6", channelId: "ic3", staffId: "s7", texto: "La escritura de la TZ-107 ya quedó inscrita. Falta actualizar el estado en la ficha.", ts: "2026-08-11T16:12:00" },
    { id: "im7", channelId: "dm1", staffId: "s5", texto: "Me confirmaron dos captaciones nuevas para la otra semana, una en Santa Elena.", ts: "2026-08-12T09:00:00" },
    { id: "im8", channelId: "dm1", staffId: ME, texto: "Perfecto, agéndalas y les tomamos fotos el mismo día.", ts: "2026-08-12T09:05:00" },
  ],
  socialPosts: [
    { id: "sp1", red: "facebook", estado: "publicado", texto: "Casa de 3 habitaciones en residencial cerrado de Santa Tecla, con patio y cuarto de servicio. Escríbenos para coordinar la visita.", fecha: "2026-08-09T10:00:00", engagement: { alcance: 18400, meGusta: 612, comentarios: 94, compartidos: 138 } },
    { id: "sp2", red: "instagram", estado: "publicado", texto: "Terreno con vista al mar sobre carretera al Litoral, 850 v², con servicios en la entrada.", fecha: "2026-08-07T17:30:00", engagement: { alcance: 12700, meGusta: 845, comentarios: 41, compartidos: 62, guardados: 310 } },
    { id: "sp3", red: "facebook", estado: "programado", texto: "Casa apta para crédito del Fondo Social, con escritura inscrita y papelería lista.", fecha: "2026-08-14T09:00:00" },
    { id: "sp4", red: "instagram", estado: "programado", texto: "Tres cosas que le piden a uno en el banco antes de aprobar un crédito de vivienda.", fecha: "2026-08-15T11:00:00" },
    { id: "sp5", red: "instagram", estado: "borrador", texto: "Lo que cambia entre comprar de contado, con banco o con el Fondo Social.", fecha: "2026-08-16T12:00:00" },
  ],
  socialStats: [
    { red: "facebook", handle: "Terrazul Bienes Raíces", seguidores: 21400, nuevosSeguidores: 1180, crecimientoPct: 5.8, alcance30d: 142600, vistas30d: 208300, interacciones30d: 9840 },
    { red: "instagram", handle: "@terrazul.sv", seguidores: 9600, nuevosSeguidores: 720, crecimientoPct: 8.1, alcance30d: 88400, vistas30d: 131200, interacciones30d: 7215 },
  ],
  metrics: [
    { label: "Conversaciones hoy", valor: 23, delta: 21 },
    { label: "Leads nuevos", valor: 9, delta: 28 },
    { label: "Tiempo de respuesta", valor: "1 min", delta: -48 },
    { label: "Visitas agendadas", valor: 6, delta: 33 },
    { label: "CSAT", valor: "4.8 / 5", delta: 3 },
    { label: "Atendidas por IA", valor: "76%", delta: 24 },
  ],
};
