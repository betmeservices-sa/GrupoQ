// Datos semilla de Grupo Q / Grupo Nissan (tenant "grupoq").
// El demo muestra leads de anuncios IG/FB; WhatsApp queda limpio para lo real.
// Timestamps fijos (sin Date.now) para un demo estable.

import type { TenantSeed } from "../types";

const ME = "me";

export const grupoqSeed: TenantSeed = {
  ME,
  departments: [
    { id: "ventas", nombre: "Vehículos Nuevos", color: "#006cb7" },
    { id: "usados", nombre: "Active Motors", color: "#f5a623" },
    { id: "taller", nombre: "Taller de Servicio", color: "#a32923" },
    { id: "repuestos", nombre: "Repuestos", color: "#9b51e0" },
    { id: "pintura", nombre: "Centro de Pintura", color: "#2baab1" },
    { id: "crediq", nombre: "CrediQ", color: "#00c040" },
    { id: "atencion", nombre: "Atención al Cliente", color: "#64748b" },
  ],
  staff: [
    { id: ME, nombre: "Gerente de Marketing", rol: "gerente_marketing", departamento: "atencion", iniciales: "GM" },
    { id: "s2", nombre: "Ana Rivas", rol: "medico", departamento: "ventas", iniciales: "AR" },
    { id: "s3", nombre: "Carlos Portillo", rol: "medico", departamento: "taller", iniciales: "CP" },
    { id: "s4", nombre: "Silvia Henríquez", rol: "jefe", departamento: "ventas", iniciales: "SH" },
    { id: "s5", nombre: "Mauricio Alfaro", rol: "medico", departamento: "crediq", iniciales: "MA" },
    { id: "s6", nombre: "Karla Cruz", rol: "recepcion", departamento: "repuestos", iniciales: "KC" },
    { id: "s7", nombre: "Verónica Bonilla", rol: "jefe", departamento: "taller", iniciales: "VB" },
    { id: "s8", nombre: "José Ramírez", rol: "recepcion", departamento: "atencion", iniciales: "JR" },
    { id: "s9", nombre: "Marta Guevara", rol: "medico", departamento: "pintura", iniciales: "MG" },
    { id: "s10", nombre: "Roberto Cáceres", rol: "medico", departamento: "usados", iniciales: "RC" },
  ],
  contacts: [
    { id: "c1", nombre: "Wendy Alvarado", handle: "@wendy.alv", canal: "instagram", notas: "Lead de anuncio de la Frontier en Instagram." },
    { id: "c2", nombre: "Stephanie Gómez", handle: "Stephanie Gómez", canal: "facebook", notas: "Quiere test drive del Kicks." },
    { id: "c3", nombre: "Jacqueline Moreno", handle: "@jacky.m", canal: "instagram" },
    { id: "c4", nombre: "Andrea Sosa", handle: "Andrea Sosa", canal: "facebook" },
    { id: "c5", nombre: "Claudia Reyes", handle: "@clau.reyes", canal: "instagram", notas: "Interesada en X-Trail e-POWER con financiamiento." },
    { id: "c6", nombre: "Rosa Campos", handle: "Rosa Campos", canal: "facebook" },
  ],
  conversations: [
    { id: "v1", canal: "instagram", contactId: "c1", departamento: "ventas", estado: "en_progreso", asignadoA: "s2", noLeidos: 0, ultimoMensajeTs: "2026-06-23T10:20:00" },
    { id: "v2", canal: "facebook", contactId: "c2", departamento: "ventas", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-06-23T10:12:00" },
    { id: "v3", canal: "instagram", contactId: "c3", departamento: "usados", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:27:00" },
    { id: "v4", canal: "facebook", contactId: "c4", departamento: "atencion", estado: "resuelto", asignadoA: ME, noLeidos: 0, ultimoMensajeTs: "2026-06-23T09:15:00" },
    { id: "v5", canal: "instagram", contactId: "c5", departamento: "crediq", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:31:00" },
    { id: "v6", canal: "facebook", contactId: "c6", departamento: "taller", estado: "resuelto", asignadoA: "s7", noLeidos: 0, ultimoMensajeTs: "2026-06-22T16:40:00" },
  ],
  messages: [
    // v1 - IG, lead de anuncio de la Frontier (en progreso)
    { id: "m1", conversationId: "v1", autor: "cliente", texto: "Hola! Vi su anuncio de la Frontier, ¿todavía tienen la promoción?", ts: "2026-06-23T10:05:00" },
    { id: "m2", conversationId: "v1", autor: "staff", staffId: "s2", texto: "Hola Wendy, claro que sí. La Frontier doble cabina está desde $40,000 y aplica el Precio de Empleado de julio. ¿Le gustaría agendar una visita para conocerla?", ts: "2026-06-23T10:12:00" },
    { id: "m3", conversationId: "v1", autor: "cliente", texto: "Sí me interesa. ¿En qué sucursales la puedo ver?", ts: "2026-06-23T10:20:00" },
    // v2 - FB, test drive del Kicks (nuevo, 2 sin leer)
    { id: "m4", conversationId: "v2", autor: "cliente", texto: "Hola, quiero agendar un test drive del Kicks.", ts: "2026-06-23T10:08:00" },
    { id: "m5", conversationId: "v2", autor: "cliente", texto: "¿Qué requisitos piden?", ts: "2026-06-23T10:12:00" },
    // v3 - IG, parte de pago (nuevo)
    { id: "m6", conversationId: "v3", autor: "cliente", texto: "Buenas, ¿aceptan mi vehículo actual como parte de pago por uno nuevo?", ts: "2026-06-23T10:27:00" },
    // v4 - FB, consulta de sucursal (resuelto)
    { id: "m7", conversationId: "v4", autor: "cliente", texto: "Buenas tardes, ¿la sucursal de Santa Elena tiene estacionamiento para clientes?", ts: "2026-06-23T09:05:00" },
    { id: "m8", conversationId: "v4", autor: "staff", staffId: "me", texto: "Buenas tardes Andrea, sí, contamos con estacionamiento propio para clientes. Con gusto la esperamos.", ts: "2026-06-23T09:15:00" },
    // v5 - IG, X-Trail e-POWER con financiamiento (nuevo)
    { id: "m9", conversationId: "v5", autor: "cliente", texto: "Hola, vi la X-Trail e-POWER en su página. ¿Tienen planes de financiamiento?", ts: "2026-06-23T10:31:00" },
    // v6 - FB, horario del taller (resuelto)
    { id: "m10", conversationId: "v6", autor: "cliente", texto: "Buenas, ¿el taller de Santa Ana atiende los sábados?", ts: "2026-06-22T16:20:00" },
    { id: "m11", conversationId: "v6", autor: "staff", staffId: "s7", texto: "Hola Rosa, sí, los sábados atendemos con cita. ¿Le agendo un espacio para su vehículo?", ts: "2026-06-22T16:35:00" },
    { id: "m12", conversationId: "v6", autor: "cliente", texto: "Perfecto, la otra semana le escribo para coordinarlo. ¡Gracias!", ts: "2026-06-22T16:40:00" },
  ],
  internalChannels: [
    { id: "ic1", nombre: "general", tipo: "canal", miembros: [ME, "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"] },
    { id: "ic2", nombre: "ventas", tipo: "canal", miembros: [ME, "s2", "s4", "s10"] },
    { id: "ic3", nombre: "taller", tipo: "canal", miembros: ["s3", "s7", "s9"] },
    { id: "ic4", nombre: "repuestos", tipo: "canal", miembros: ["s6", "s7"] },
    { id: "ic5", nombre: "entregas", tipo: "canal", miembros: [ME, "s2", "s3", "s4"] },
    { id: "dm1", nombre: "Verónica Bonilla", tipo: "dm", miembros: [ME, "s7"] },
    { id: "dm2", nombre: "Carlos Portillo", tipo: "dm", miembros: [ME, "s3"] },
  ],
  internalMessages: [
    { id: "im1", channelId: "ic1", staffId: "s4", texto: "Buenos días equipo. Recuerden que el sábado tenemos la feria de seminuevos en el patio principal.", ts: "2026-06-23T08:00:00" },
    { id: "im2", channelId: "ic1", staffId: "s8", texto: "Anotado. Ya tenemos 12 clientes confirmados para test drive.", ts: "2026-06-23T08:12:00" },
    { id: "im3", channelId: "ic1", staffId: ME, texto: "Perfecto. Atención al Cliente coordina el orden de llegada para que no se sature la sala.", ts: "2026-06-23T08:20:00" },
    { id: "im4", channelId: "ic2", staffId: "s2", texto: "Silvia, ¿me confirmas si queda Frontier gris en inventario para entrega inmediata?", ts: "2026-06-23T09:10:00" },
    { id: "im5", channelId: "ic2", staffId: "s4", texto: "Sí, queda una unidad. Te la reservo para tu cliente.", ts: "2026-06-23T09:18:00" },
    { id: "im6", channelId: "ic5", staffId: "s3", texto: "Ingresó un vehículo en grúa con falla eléctrica. Lo estamos evaluando en la bahía 1.", ts: "2026-06-23T07:45:00" },
    { id: "im7", channelId: "ic5", staffId: "s7", texto: "Voy en camino para apoyar. Tengan listo el escáner de diagnóstico.", ts: "2026-06-23T07:48:00" },
    { id: "im8", channelId: "dm1", staffId: "s7", texto: "¿Me pasas el reporte de conversaciones de la semana para la reunión?", ts: "2026-06-23T09:50:00" },
    { id: "im9", channelId: "dm1", staffId: ME, texto: "Claro Verónica, se lo envío antes del mediodía.", ts: "2026-06-23T09:55:00" },
  ],
  socialPosts: [
    { id: "sp1", red: "instagram", estado: "publicado", texto: "La nueva Frontier te está esperando. Agenda tu test drive hoy mismo. Vas a llegar.", fecha: "2026-06-22T09:00:00", engagement: { alcance: 8420, meGusta: 612, comentarios: 38, compartidos: 47, guardados: 121 } },
    { id: "sp2", red: "facebook", estado: "publicado", texto: "Nuestro Taller de Servicio cuenta con técnicos certificados y repuestos originales de fábrica. Tu vehículo en las mejores manos.", fecha: "2026-06-21T15:00:00", engagement: { alcance: 11200, meGusta: 540, comentarios: 64, compartidos: 132 } },
    { id: "sp3", red: "instagram", estado: "programado", texto: "Conoce Active Motors: seminuevos certificados con garantía y respaldo Grupo Q. Agenda tu visita.", fecha: "2026-06-24T10:00:00" },
    { id: "sp4", red: "facebook", estado: "programado", texto: "Precio de Empleado: del 1 al 31 de julio, con tasa desde el 7.99% y plazos de hasta 108 meses. Escríbenos por mensaje directo.", fecha: "2026-06-25T08:00:00" },
    { id: "sp5", red: "instagram", estado: "borrador", texto: "5 señales de que tu vehículo ya necesita servicio. Te contamos en este carrusel.", fecha: "2026-06-23T12:00:00" },
  ],
  socialStats: [
    { red: "instagram", handle: "@grupoq_centroamerica", seguidores: 18420, nuevosSeguidores: 574, crecimientoPct: 3.2, alcance30d: 42100, vistas30d: 96300, interacciones30d: 5840 },
    { red: "facebook", handle: "Grupo Q Centroamérica", seguidores: 31250, nuevosSeguidores: 412, crecimientoPct: 1.4, alcance30d: 58700, vistas30d: 121400, interacciones30d: 7920 },
  ],
  metrics: [
    { label: "Conversaciones hoy", valor: 38, delta: 12 },
    { label: "Leads de anuncios", valor: 21, delta: 15 },
    { label: "Tiempo de respuesta", valor: "6 min", delta: -18 },
    { label: "Tiempo medio de atención", valor: "9 min", delta: -6 },
    { label: "CSAT", valor: "4.6 / 5", delta: 3 },
    { label: "Atendidas por IA", valor: "64%", delta: 9 },
  ],
};
