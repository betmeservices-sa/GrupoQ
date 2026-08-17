// Datos semilla del tenant "promerica" (Banco Promerica, El Salvador).
// Conversaciones, equipo y redes de DEMOSTRACIÓN. La cartera de mora vive
// aparte, en lib/cobros-datos.ts, porque la usan también las rutas de API.
// Las personas son inventadas. Timestamps fijos para que el demo se vea igual
// siempre.

import type { TenantSeed } from "../types";

const ME = "me";

export const promericaSeed: TenantSeed = {
  ME,
  departments: [
    { id: "cobranza", nombre: "Cobranza", color: "#00693c" },
    { id: "atencion", nombre: "Servicio al Cliente", color: "#549820" },
    { id: "legal", nombre: "Legal", color: "#8a5300" },
    { id: "ventas", nombre: "Productos", color: "#5c6a62" },
  ],
  staff: [
    { id: ME, nombre: "Jefe de Cobranza", rol: "gerente_marketing", departamento: "cobranza", iniciales: "JC" },
    { id: "s2", nombre: "Alejandra Portillo", rol: "medico", departamento: "cobranza", iniciales: "AP" },
    { id: "s3", nombre: "Douglas Menjívar", rol: "medico", departamento: "cobranza", iniciales: "DM" },
    { id: "s4", nombre: "Karla Bonilla", rol: "medico", departamento: "cobranza", iniciales: "KB" },
    { id: "s5", nombre: "Rodrigo Escalante", rol: "jefe", departamento: "legal", iniciales: "RE" },
    { id: "s6", nombre: "Fátima Argueta", rol: "recepcion", departamento: "atencion", iniciales: "FA" },
    { id: "s7", nombre: "Nadia Quintanilla", rol: "marketing", departamento: "ventas", iniciales: "NQ" },
  ],
  contacts: [
    { id: "c1", nombre: "Luis Alberto Menjívar", telefono: "50378541209", canal: "whatsapp", notas: "Tarjeta con 34 días de mora. Promesa para el viernes.", tags: ["Promesa de pago"] },
    { id: "c2", nombre: "Rosa Elena Portillo", telefono: "50370119088", canal: "whatsapp", notas: "Sin empleo desde junio. Pide convenio.", tags: ["Pide convenio"] },
    { id: "c3", nombre: "Herman Portillo Guevara", handle: "Herman Portillo", canal: "facebook", notas: "Reclama cobro de seguro no contratado.", tags: ["Reclamo de cobro"] },
    { id: "c4", nombre: "Marielos Guzmán", handle: "@marielos.gzmn", canal: "instagram", tags: ["Consulta de saldo"] },
    { id: "c5", nombre: "Sandra Melgar", telefono: "50376113420", canal: "whatsapp", notas: "Abonó la mitad, completa a fin de mes.", tags: ["Abono parcial"] },
    { id: "c6", nombre: "Jorge Alberto Henríquez", telefono: "50370338826", canal: "whatsapp", notas: "Crédito de vivienda, quiere refinanciar.", tags: ["Pide convenio"] },
  ],
  conversations: [
    { id: "v1", canal: "whatsapp", contactId: "c1", departamento: "cobranza", estado: "en_progreso", asignadoA: "s2", noLeidos: 1, ultimoMensajeTs: "2026-08-17T09:41:00" },
    { id: "v2", canal: "whatsapp", contactId: "c2", departamento: "cobranza", estado: "en_progreso", asignadoA: "s3", noLeidos: 0, ultimoMensajeTs: "2026-08-17T09:12:00" },
    { id: "v3", canal: "facebook", contactId: "c3", departamento: "atencion", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-08-17T08:35:00" },
    { id: "v4", canal: "instagram", contactId: "c4", departamento: "atencion", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-08-16T18:20:00" },
    { id: "v5", canal: "whatsapp", contactId: "c5", departamento: "cobranza", estado: "resuelto", asignadoA: "s4", noLeidos: 0, ultimoMensajeTs: "2026-08-16T16:04:00" },
    { id: "v6", canal: "whatsapp", contactId: "c6", departamento: "legal", estado: "en_progreso", asignadoA: "s5", noLeidos: 0, ultimoMensajeTs: "2026-08-15T15:30:00" },
  ],
  messages: [
    { id: "m1", conversationId: "v1", autor: "cliente", texto: "Buenos días, me llamaron del banco. Sí voy a pagar el viernes, solo que me pagan hasta ese día.", ts: "2026-08-17T09:38:00" },
    { id: "m2", conversationId: "v1", autor: "staff", staffId: "s2", texto: "Buenos días don Luis. Perfecto, queda anotado el compromiso para el viernes. Le mandamos el recordatorio ese mismo día.", ts: "2026-08-17T09:41:00" },

    { id: "m3", conversationId: "v2", autor: "cliente", texto: "Quiero arreglar mi préstamo pero no puedo con la cuota completa. ¿Qué opciones hay?", ts: "2026-08-17T08:55:00" },
    { id: "m4", conversationId: "v2", autor: "staff", staffId: "s3", texto: "Con gusto lo revisamos, doña Rosa. Un asesor la va a contactar hoy mismo para ver el plan que le calce.", ts: "2026-08-17T09:12:00" },

    { id: "m5", conversationId: "v3", autor: "cliente", texto: "Me están cobrando un seguro que yo nunca contraté.", ts: "2026-08-17T08:20:00" },
    { id: "m6", conversationId: "v3", autor: "cliente", texto: "Necesito el estado de cuenta detallado antes de pagar nada.", ts: "2026-08-17T08:35:00" },

    { id: "m7", conversationId: "v4", autor: "cliente", texto: "Hola, ¿cuánto tengo que pagar este mes de la tarjeta?", ts: "2026-08-16T18:20:00" },

    { id: "m8", conversationId: "v5", autor: "cliente", texto: "Ya hice el abono de 312 por banca en línea. El resto se los completo a fin de mes.", ts: "2026-08-16T15:48:00" },
    { id: "m9", conversationId: "v5", autor: "staff", staffId: "s4", texto: "Recibido, doña Sandra. Gracias por avisar, ya quedó reflejado en su cuenta.", ts: "2026-08-16T16:04:00" },

    { id: "m10", conversationId: "v6", autor: "cliente", texto: "Quiero refinanciar el crédito de la casa. ¿Cómo me quedaría la cuota?", ts: "2026-08-15T14:50:00" },
    { id: "m11", conversationId: "v6", autor: "staff", staffId: "s5", texto: "Le preparamos la propuesta con dos plazos, don Jorge. Se la enviamos por correo esta semana.", ts: "2026-08-15T15:30:00" },
  ],
  internalChannels: [
    { id: "ic1", nombre: "general", tipo: "canal", miembros: [ME, "s2", "s3", "s4", "s5", "s6", "s7"] },
    { id: "ic2", nombre: "cobranza", tipo: "canal", miembros: [ME, "s2", "s3", "s4"] },
    { id: "ic3", nombre: "legal", tipo: "canal", miembros: [ME, "s5"] },
    { id: "dm1", nombre: "Rodrigo Escalante", tipo: "dm", miembros: [ME, "s5"] },
    { id: "dm2", nombre: "Karla Bonilla", tipo: "dm", miembros: [ME, "s4"] },
  ],
  internalMessages: [
    { id: "im1", channelId: "ic1", staffId: ME, texto: "Buenos días. Hoy priorizamos las promesas vencidas: son las que se caen si nadie las toca esta semana.", ts: "2026-08-17T07:30:00" },
    { id: "im2", channelId: "ic2", staffId: "s2", texto: "La campaña de tramo 31 a 60 terminó anoche. Sacó 41 promesas de 380 llamadas.", ts: "2026-08-17T07:41:00" },
    { id: "im3", channelId: "ic2", staffId: "s3", texto: "Ojo con Sibrián: tercera promesa que no cumple. Ya no lo dejemos en campaña automática.", ts: "2026-08-17T08:02:00" },
    { id: "im4", channelId: "ic2", staffId: ME, texto: "De acuerdo, lo paso a gestión con nombre y apellido. Que lo llame Karla.", ts: "2026-08-17T08:06:00" },
    { id: "im5", channelId: "ic3", staffId: "s5", texto: "Iraheta ya pasó los 150 días. Lo trasladé a legal ayer.", ts: "2026-08-16T16:12:00" },
    { id: "im6", channelId: "dm1", staffId: "s5", texto: "El reclamo del seguro de Portillo hay que resolverlo antes de volver a cobrarle.", ts: "2026-08-17T09:00:00" },
    { id: "im7", channelId: "dm1", staffId: ME, texto: "Sí, lo saqué de la campaña mientras tanto.", ts: "2026-08-17T09:05:00" },
  ],
  socialPosts: [
    { id: "sp1", red: "facebook", estado: "publicado", texto: "Ponerse al día es más fácil de lo que parece. Acércate a cualquier agencia y conversemos sobre las opciones que tenemos para ti.", fecha: "2026-08-12T10:00:00", engagement: { alcance: 24800, meGusta: 412, comentarios: 63, compartidos: 88 } },
    { id: "sp2", red: "instagram", estado: "publicado", texto: "Tres cosas que sí puedes hacer si te atrasaste con un pago este mes.", fecha: "2026-08-10T17:30:00", engagement: { alcance: 16400, meGusta: 921, comentarios: 47, compartidos: 74, guardados: 380 } },
    { id: "sp3", red: "facebook", estado: "programado", texto: "Recuerda que puedes revisar el detalle de tu cuenta desde la banca en línea, sin hacer fila.", fecha: "2026-08-19T09:00:00" },
    { id: "sp4", red: "instagram", estado: "borrador", texto: "Qué es una promesa de pago y por qué conviene cumplirla.", fecha: "2026-08-21T12:00:00" },
  ],
  socialStats: [
    { red: "facebook", handle: "Banco Promerica El Salvador", seguidores: 318400, nuevosSeguidores: 4120, crecimientoPct: 1.3, alcance30d: 1284000, vistas30d: 1830000, interacciones30d: 42800 },
    { red: "instagram", handle: "@promericasv", seguidores: 96200, nuevosSeguidores: 2810, crecimientoPct: 3.0, alcance30d: 486000, vistas30d: 712000, interacciones30d: 31500 },
  ],
  metrics: [
    { label: "Llamadas de cobro hoy", valor: 412, delta: 18 },
    { label: "Contacto efectivo", valor: "38%", delta: 6 },
    { label: "Promesas obtenidas", valor: 47, delta: 24 },
    { label: "Monto prometido", valor: "$18,240", delta: 21 },
    { label: "Recuperado del mes", valor: "$126,480", delta: 14 },
    { label: "Atendidas por IA", valor: "91%", delta: 9 },
  ],
};
