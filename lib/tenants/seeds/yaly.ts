// Datos semilla del tenant "yaly" (Yali Hospitality, tres hoteles de playa).
// Son conversaciones y equipo de DEMOSTRACIÓN, como en el resto de clientes.
// Timestamps fijos (sin Date.now) para un demo estable.
//
// OJO: los nombres de sucursal que aparecen abajo salen de
// lib/tenants/yaly-sucursales.ts, que es el único lugar donde se editan.

import type { TenantSeed } from "../types";
import { yalySucursales } from "../yaly-sucursales";

const ME = "me";
const [SUC_A, SUC_B, SUC_C] = yalySucursales.opciones.map((o) => o.nombre);

export const yalySeed: TenantSeed = {
  ME,
  // Membresías es un departamento aparte y no un sabor de ventas. Jaime lo dijo
  // así en el kickoff: "reservas es la banca tradicional y membresía es banca
  // privada". Quien atiende socios no atiende reservas y al revés.
  departments: [
    { id: "reservas", nombre: "Reservas", color: "#0e7490" },
    { id: "membresias", nombre: "Membresías", color: "#b45309" },
    { id: "recepcion", nombre: "Recepción", color: "#7c3aed" },
    { id: "conserjeria", nombre: "Conserjería", color: "#2e9e5b" },
    { id: "atencion", nombre: "Atención al Huésped", color: "#64748b" },
  ],
  // Las personas que pidieron usuario en el kickoff del 24 de agosto de 2026.
  staff: [
    { id: ME, nombre: "Gerente de Marketing", rol: "gerente_marketing", departamento: "atencion", iniciales: "GM" },
    { id: "s2", nombre: "Verónica Viches", rol: "medico", departamento: "reservas", iniciales: "VV" },
    { id: "s3", nombre: "Olga", rol: "marketing", departamento: "membresias", iniciales: "OL" },
    { id: "s4", nombre: "Jaime Quintanilla", rol: "jefe", departamento: "reservas", iniciales: "JQ" },
    { id: "s5", nombre: "Dino Safie", rol: "jefe", departamento: "atencion", iniciales: "DS" },
    { id: "s6", nombre: "José Mauricio", rol: "recepcion", departamento: "recepcion", iniciales: "JM" },
  ],
  contacts: [
    { id: "c1", nombre: "Mariela Escobar", telefono: "50378114420", canal: "whatsapp", notas: `Escribe a ${SUC_A}. Quiere dos habitaciones para el fin de semana.`, tags: ["Consulta de disponibilidad"] },
    { id: "c2", nombre: "Josué Ramírez", telefono: "50361239087", canal: "whatsapp", notas: `Se comunicó con ${SUC_B}. Pide cotización de salón para 60 personas.`, tags: ["Grupo o evento"] },
    { id: "c3", nombre: "Andrea Peña", handle: "@andrea.pena", canal: "instagram", notas: `Preguntó por ${SUC_C} tras ver una publicación.` },
    { id: "c4", nombre: "Familia Alvarado", handle: "Familia Alvarado", canal: "facebook", notas: "Aniversario de bodas, mandaron foto de la habitación que quieren." },
    { id: "c5", nombre: "Rodrigo Cáceres", telefono: "50372558814", canal: "whatsapp", notas: "Corporativo, se hospeda dos noches al mes.", tags: ["Corporativo"] },
  ],
  conversations: [
    { id: "v1", canal: "whatsapp", contactId: "c1", departamento: "reservas", estado: "en_progreso", asignadoA: "s2", noLeidos: 0, ultimoMensajeTs: "2026-08-14T10:15:00", sucursalId: "a" },
    { id: "v2", canal: "whatsapp", contactId: "c2", departamento: "reservas", estado: "en_progreso", asignadoA: ME, noLeidos: 2, ultimoMensajeTs: "2026-08-14T09:48:00", sucursalId: "b" },
    { id: "v3", canal: "instagram", contactId: "c3", departamento: "recepcion", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-08-14T10:31:00", sucursalId: "c" },
    { id: "v4", canal: "facebook", contactId: "c4", departamento: "atencion", estado: "en_progreso", asignadoA: "s5", noLeidos: 0, ultimoMensajeTs: "2026-08-14T08:55:00", sucursalId: "a" },
    { id: "v5", canal: "whatsapp", contactId: "c5", departamento: "atencion", estado: "resuelto", asignadoA: ME, noLeidos: 0, ultimoMensajeTs: "2026-08-13T17:20:00", sucursalId: "c" },
  ],
  messages: [
    // v1 - dos habitaciones, sucursal ya identificada
    { id: "m1", conversationId: "v1", autor: "cliente", texto: "Buenos días, ¿tienen dos habitaciones para el sábado?", ts: "2026-08-14T09:55:00" },
    { id: "m2", conversationId: "v1", autor: "staff", staffId: "s2", texto: `Buenos días. Le confirmo para ${SUC_A}: ¿serían dos habitaciones dobles?`, ts: "2026-08-14T10:04:00" },
    { id: "m3", conversationId: "v1", autor: "cliente", texto: "Sí, dobles. ¿Cuánto sale la noche?", ts: "2026-08-14T10:12:00" },
    // Nota de voz YA TRANSCRITA, tal como la guarda el webhook: la marca
    // "[audio]" adelante y la transcripción detrás (ver lib/transcribir.ts). El
    // archivo es de demostración y lo servimos nosotros desde /public, porque no
    // tiene media_id de Meta.
    {
      id: "m11",
      conversationId: "v1",
      autor: "cliente",
      texto:
        "[audio] Hola, buenas tardes. Quiero reservar una habitación para el viernes y el sábado, somos dos adultos y un niño. Me interesa la que tiene vista al mar. Gracias.",
      ts: "2026-08-14T10:15:00",
      media: { id: "demo-nota-voz", tipo: "audio", mime: "audio/ogg", url: "/demo/nota-voz-yali.ogg" },
    },
    // v2 - evento
    { id: "m4", conversationId: "v2", autor: "cliente", texto: "Buenas, necesito salón para 60 personas.", ts: "2026-08-14T09:40:00" },
    { id: "m5", conversationId: "v2", autor: "cliente", texto: "Sería el último viernes del mes, por la noche.", ts: "2026-08-14T09:48:00" },
    // v3 - viene de una publicación
    { id: "m6", conversationId: "v3", autor: "cliente", texto: "Hola, vi la foto de la piscina. ¿En cuál sucursal está?", ts: "2026-08-14T10:31:00" },
    // v4 - aniversario con foto
    { id: "m7", conversationId: "v4", autor: "cliente", texto: "Les mando foto de la habitación que vimos. ¿Esa la tienen libre el 20?", ts: "2026-08-14T08:41:00" },
    { id: "m8", conversationId: "v4", autor: "staff", staffId: "s5", texto: "Recibida la foto, es la suite con balcón. Se la reviso para el 20 y le confirmo hoy mismo.", ts: "2026-08-14T08:55:00" },
    // v5 - corporativo
    { id: "m9", conversationId: "v5", autor: "cliente", texto: "Gracias por la factura, todo bien.", ts: "2026-08-13T17:08:00" },
    { id: "m10", conversationId: "v5", autor: "staff", staffId: "me", texto: "Con gusto, don Rodrigo. Le dejamos su tarifa corporativa lista para el próximo mes.", ts: "2026-08-13T17:20:00" },
  ],
  internalChannels: [
    { id: "ic1", nombre: "general", tipo: "canal", miembros: [ME, "s2", "s3", "s4", "s5", "s6"] },
    { id: "ic2", nombre: "reservas", tipo: "canal", miembros: [ME, "s2", "s4"] },
    { id: "ic3", nombre: "hoteles", tipo: "canal", miembros: [ME, "s3", "s4", "s6"] },
    { id: "ic4", nombre: "membresias", tipo: "canal", miembros: [ME, "s3", "s4"] },
    { id: "dm1", nombre: "Jaime Quintanilla", tipo: "dm", miembros: [ME, "s4"] },
    { id: "dm2", nombre: "Olga", tipo: "dm", miembros: [ME, "s3"] },
  ],
  internalMessages: [
    { id: "im1", channelId: "ic1", staffId: "s4", texto: "Recuerden confirmar la sucursal antes de cotizar. Ayer se mandaron dos tarifas cruzadas.", ts: "2026-08-14T07:20:00" },
    { id: "im2", channelId: "ic1", staffId: "s6", texto: "Anotado. El agente ya pregunta la sucursal en el primer mensaje.", ts: "2026-08-14T07:35:00" },
    { id: "im3", channelId: "ic3", staffId: "s3", texto: `En ${SUC_B} quedan 4 habitaciones libres para el sábado.`, ts: "2026-08-14T08:10:00" },
    { id: "im4", channelId: "ic3", staffId: "s6", texto: `En ${SUC_C} está full desde el jueves por el torneo de surf.`, ts: "2026-08-14T08:22:00" },
    { id: "im5", channelId: "ic2", staffId: "s2", texto: "Subo las tarifas de temporada alta al mediodía.", ts: "2026-08-14T09:05:00" },
    { id: "im6", channelId: "ic4", staffId: "s5", texto: "El salón grande necesita montaje nuevo. Lo veo con mantenimiento.", ts: "2026-08-13T16:40:00" },
    { id: "im7", channelId: "dm1", staffId: "s4", texto: "¿Me pasas el consumo del agente de esta semana?", ts: "2026-08-14T09:30:00" },
    { id: "im8", channelId: "dm1", staffId: ME, texto: "Va en el dashboard, con el desglose de texto e imágenes.", ts: "2026-08-14T09:34:00" },
  ],
  socialPosts: [
    { id: "sp1", red: "instagram", estado: "publicado", texto: "Tres hoteles frente al mar, una sola forma de recibirte. Escríbenos y te decimos cuál te queda mejor.", fecha: "2026-08-12T08:00:00", engagement: { alcance: 11200, meGusta: 604, comentarios: 41, compartidos: 63, guardados: 188 } },
    { id: "sp2", red: "facebook", estado: "publicado", texto: "Piscina, restaurante y el Pacífico enfrente. Escríbenos y te decimos qué hay libre este fin de semana.", fecha: "2026-08-10T17:30:00", engagement: { alcance: 8400, meGusta: 311, comentarios: 29, compartidos: 44 } },
    { id: "sp3", red: "instagram", estado: "programado", texto: "Check in desde las 3:00 p.m. Llegas, dejas el equipaje y te bajas a la playa.", fecha: "2026-08-16T09:00:00" },
    { id: "sp4", red: "facebook", estado: "programado", texto: "Tarifa corporativa para estadías de dos noches o más. Consulta por mensaje.", fecha: "2026-08-18T10:00:00" },
    { id: "sp5", red: "instagram", estado: "borrador", texto: "Cómo elegir entre El Sunzal, Las Flores y el Litoral según el plan.", fecha: "2026-08-17T12:00:00" },
  ],
  socialStats: [
    { red: "instagram", handle: "@yalihospitality", seguidores: 14300, nuevosSeguidores: 820, crecimientoPct: 6.1, alcance30d: 96400, vistas30d: 178000, interacciones30d: 9120 },
    { red: "facebook", handle: "Yali Hospitality", seguidores: 21700, nuevosSeguidores: 640, crecimientoPct: 3.0, alcance30d: 64100, vistas30d: 88300, interacciones30d: 4380 },
    { red: "tiktok", handle: "@yalihospitality", seguidores: 9800, nuevosSeguidores: 2100, crecimientoPct: 27.3, vistas30d: 264000, meGusta30d: 15400, comentarios30d: 980, compartidos30d: 1740 },
  ],
  metrics: [
    { label: "Conversaciones hoy", valor: 38, delta: 22 },
    { label: "Consultas de disponibilidad", valor: 24, delta: 17 },
    { label: "Tiempo de respuesta", valor: "1 min", delta: -55 },
    { label: "Tiempo medio de atención", valor: "4 min", delta: -21 },
    { label: "CSAT", valor: "4.8 / 5", delta: 3 },
    { label: "Atendidas por IA", valor: "86%", delta: 24 },
  ],
};
