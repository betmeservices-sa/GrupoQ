// Datos semilla de Grupo Q / Grupo Nissan (tenant "grupoq").
// Timestamps fijos (sin Date.now) para un demo estable.
//
// Antes WhatsApp se dejaba vacío a propósito, para que un número conectado de
// verdad no mezclara conversaciones reales con las de ejemplo. Eso dejaba dos
// pantallas en blanco en el demo: Contactos, que llavea la ficha por teléfono y
// por eso ignora a los contactos que solo tienen handle de IG o FB, y Mis
// chats, que lista lo que el agente ya pasó a una persona.
//
// Ahora sí hay chats de WhatsApp de ejemplo. La contrapartida: si a este tenant
// se le conecta un número real, estos conviven con los de verdad hasta que se
// borre el seed. Con Supabase configurado el problema no existe, porque ahí
// manda la base y el seed ni se lee (ver sembrarDesdeSeed en contacts-store).

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
    // De acá para abajo, contactos de WhatsApp. Van CON teléfono a propósito:
    // la pestaña Contactos llavea la ficha por número, así que los de arriba,
    // que solo tienen handle de Instagram o Facebook, nunca aparecen ahí. Sin
    // estos, esa pantalla se ve vacía en el demo.
    //
    // Cada uno lleva su etapa del proceso y el vehículo que está viendo, que es
    // lo que un asesor necesita ver de un vistazo antes de contestar.
    { id: "c7", nombre: "Óscar Molina", telefono: "+503 7712 4408", correo: "omolina@gmail.com", canal: "whatsapp", tags: ["Interés Pickup", "Pre-aprobado"], notas: "Frontier Doble Cabina diésel. CrediQ lo pre-aprobó a 60 meses con prima del 20%. Trabaja en construcción, la quiere para obra." },
    { id: "c8", nombre: "Gabriela Portillo", telefono: "+503 7845 3391", correo: "gaby.portillo@outlook.com", canal: "whatsapp", tags: ["Interés SUV", "Pendiente documentos"], notas: "X-Trail e-POWER. Le faltan las últimas dos boletas de pago y la copia del DUI para completar el expediente." },
    { id: "c9", nombre: "Luis Menéndez", telefono: "+503 6023 7714", correo: "lmenendez@hotmail.com", canal: "whatsapp", tags: ["Interés SUV", "Aprobado"], notas: "Kicks aprobado por CrediQ a 72 meses. Falta que elija color: pidió ver el gris y el rojo." },
    { id: "c10", nombre: "Marielos Cañas", telefono: "+503 7190 6652", correo: "mcanas@gmail.com", canal: "whatsapp", tags: ["Interés SUV", "Cotización enviada"], notas: "Qashqai. Se le mandó cotización el lunes, está comparando contra una compra de contado." },
    { id: "c11", nombre: "Ernesto Batres", telefono: "+503 7433 8807", canal: "whatsapp", tags: ["Interés Pickup", "Test drive agendado"], notas: "Frontier Cabina Simple. Test drive el sábado a las 10 en la sucursal principal." },
    { id: "c12", nombre: "Patricia Aguilar", telefono: "+503 6688 2214", correo: "paguilar@yahoo.com", canal: "whatsapp", tags: ["Interés SUV", "Pendiente documentos"], notas: "X-Trail gasolina. Es su primer vehículo financiado; hay que explicarle bien qué papelería pide CrediQ." },
    { id: "c13", nombre: "Diego Salazar", telefono: "+503 7052 9938", correo: "dsalazar@gmail.com", canal: "whatsapp", tags: ["Interés SUV", "Entrega programada"], notas: "Kicks. Entrega el viernes a las 3 de la tarde, ya firmó. Pidió que le expliquen el CarPlay al recibirlo." },
    { id: "c14", nombre: "Rocío Zelaya", telefono: "+503 7361 4470", correo: "rzelaya@gmail.com", canal: "whatsapp", tags: ["Interés Pickup", "Pre-aprobado"], notas: "Frontier. Pre-aprobada, pero quiere bajar la cuota: pidió cotizar a 84 meses." },
  ],
  conversations: [
    { id: "v1", canal: "instagram", contactId: "c1", departamento: "ventas", estado: "en_progreso", asignadoA: "s2", noLeidos: 0, ultimoMensajeTs: "2026-06-23T10:20:00" },
    { id: "v2", canal: "facebook", contactId: "c2", departamento: "ventas", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-06-23T10:12:00" },
    { id: "v3", canal: "instagram", contactId: "c3", departamento: "usados", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:27:00" },
    { id: "v4", canal: "facebook", contactId: "c4", departamento: "atencion", estado: "resuelto", asignadoA: ME, noLeidos: 0, ultimoMensajeTs: "2026-06-23T09:15:00" },
    { id: "v5", canal: "instagram", contactId: "c5", departamento: "crediq", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:31:00" },
    { id: "v6", canal: "facebook", contactId: "c6", departamento: "taller", estado: "resuelto", asignadoA: "s7", noLeidos: 0, ultimoMensajeTs: "2026-06-22T16:40:00" },
    // Los chats de WhatsApp. Varios quedan asignados a ME porque un chat con
    // dueño es justo lo que la IA ya no contesta: son los que caen en "Mis
    // chats", la pantalla de lo que Sofía pasó a una persona.
    { id: "v7", canal: "whatsapp", contactId: "c7", departamento: "crediq", estado: "en_progreso", asignadoA: ME, noLeidos: 0, ultimoMensajeTs: "2026-06-23T10:41:00" },
    { id: "v8", canal: "whatsapp", contactId: "c8", departamento: "crediq", estado: "en_progreso", asignadoA: ME, noLeidos: 1, ultimoMensajeTs: "2026-06-23T10:36:00" },
    { id: "v9", canal: "whatsapp", contactId: "c9", departamento: "ventas", estado: "en_progreso", asignadoA: "s5", noLeidos: 0, ultimoMensajeTs: "2026-06-23T09:58:00" },
    { id: "v10", canal: "whatsapp", contactId: "c10", departamento: "ventas", estado: "nuevo", asignadoA: ME, noLeidos: 2, ultimoMensajeTs: "2026-06-23T10:44:00" },
    { id: "v11", canal: "whatsapp", contactId: "c11", departamento: "ventas", estado: "en_progreso", asignadoA: "s2", noLeidos: 0, ultimoMensajeTs: "2026-06-23T09:31:00" },
    { id: "v12", canal: "whatsapp", contactId: "c13", departamento: "ventas", estado: "en_progreso", asignadoA: ME, noLeidos: 0, ultimoMensajeTs: "2026-06-23T10:29:00" },
    { id: "v13", canal: "whatsapp", contactId: "c14", departamento: "crediq", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-06-23T10:47:00" },
    { id: "v14", canal: "whatsapp", contactId: "c12", departamento: "crediq", estado: "en_progreso", asignadoA: "s5", noLeidos: 0, ultimoMensajeTs: "2026-06-23T08:52:00" },
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
    // --- WhatsApp ---
    // v7 - Oscar, pre-aprobado, empujando el cierre (mio)
    { id: "m13", conversationId: "v7", autor: "cliente", texto: "Buenos dias, me llamaron de CrediQ que ya sali pre-aprobado. Que sigue?", ts: "2026-06-23T10:31:00" },
    { id: "m14", conversationId: "v7", autor: "staff", staffId: ME, texto: "Buenos dias don Oscar, correcto. Quedo pre-aprobado a 60 meses con prima del 20%. Lo que sigue es traer DUI, NIT y las dos ultimas boletas de pago, y con eso armamos el expediente final.", ts: "2026-06-23T10:38:00" },
    { id: "m15", conversationId: "v7", autor: "cliente", texto: "Perfecto. Las boletas las tengo en digital, se las puedo mandar por aqui?", ts: "2026-06-23T10:41:00" },
    // v8 - Gabriela, le falta papeleria (mio, 1 sin leer)
    { id: "m16", conversationId: "v8", autor: "staff", staffId: ME, texto: "Buenos dias Gabriela, le escribo por la X-Trail e-POWER. Para cerrar el expediente solo faltan las dos ultimas boletas de pago y la copia del DUI.", ts: "2026-06-23T09:12:00" },
    { id: "m17", conversationId: "v8", autor: "cliente", texto: "Si disculpe, ando fuera esta semana. El lunes le mando todo sin falta.", ts: "2026-06-23T10:36:00" },
    // v9 - Luis, ya aprobado, eligiendo color
    { id: "m18", conversationId: "v9", autor: "cliente", texto: "Me confirmaron que quedo aprobado el Kicks. Lo puedo ver en gris?", ts: "2026-06-23T09:44:00" },
    { id: "m19", conversationId: "v9", autor: "staff", staffId: "s5", texto: "Asi es don Luis, aprobado a 72 meses. Tenemos el gris y el rojo en sala. Le aparto los dos para que los vea juntos y decida.", ts: "2026-06-23T09:58:00" },
    // v10 - Marielos, comparando contra contado (mio, 2 sin leer)
    { id: "m20", conversationId: "v10", autor: "staff", staffId: ME, texto: "Buenas tardes Marielos, le comparto la cotizacion del Qashqai que quedamos.", ts: "2026-06-22T15:20:00" },
    { id: "m21", conversationId: "v10", autor: "cliente", texto: "Gracias. Una consulta, si lo pago de contado hay algun descuento adicional?", ts: "2026-06-23T10:40:00" },
    { id: "m22", conversationId: "v10", autor: "cliente", texto: "Y cuanto seria la cuota a 60 meses para comparar?", ts: "2026-06-23T10:44:00" },
    // v11 - Ernesto, test drive el sabado
    { id: "m23", conversationId: "v11", autor: "cliente", texto: "Queria probar la Frontier cabina simple antes de decidir.", ts: "2026-06-23T09:20:00" },
    { id: "m24", conversationId: "v11", autor: "staff", staffId: "s2", texto: "Con gusto don Ernesto. Le agende el test drive el sabado a las diez en la sucursal principal. Solo traiga su licencia vigente.", ts: "2026-06-23T09:31:00" },
    // v12 - Diego, entrega el viernes (mio)
    { id: "m25", conversationId: "v12", autor: "cliente", texto: "Todo listo para el viernes? A que hora paso por el carro?", ts: "2026-06-23T10:22:00" },
    { id: "m26", conversationId: "v12", autor: "staff", staffId: ME, texto: "Todo listo don Diego. La entrega es el viernes a las tres de la tarde. Calcule una hora, ahi mismo le configuramos el CarPlay y le explicamos el mantenimiento.", ts: "2026-06-23T10:29:00" },
    // v13 - Rocio, quiere bajar la cuota (sin asignar, 2 sin leer)
    { id: "m27", conversationId: "v13", autor: "cliente", texto: "Buenos dias, ya me dijeron que sali pre-aprobada para la Frontier.", ts: "2026-06-23T10:45:00" },
    { id: "m28", conversationId: "v13", autor: "cliente", texto: "Pero la cuota me queda alta. Se podra a 84 meses?", ts: "2026-06-23T10:47:00" },
    // v14 - Patricia, primer financiamiento
    { id: "m29", conversationId: "v14", autor: "cliente", texto: "Es la primera vez que voy a financiar un carro, que papeles necesito?", ts: "2026-06-23T08:40:00" },
    { id: "m30", conversationId: "v14", autor: "staff", staffId: "s5", texto: "Con gusto le explico Patricia. Para la X-Trail son tres cosas: DUI y NIT, las dos ultimas boletas de pago y una constancia laboral. Nada mas, y el tramite sale en 48 horas.", ts: "2026-06-23T08:52:00" },
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
    { red: "tiktok", handle: "@grupoq", seguidores: 23700, nuevosSeguidores: 4100, crecimientoPct: 20.9, vistas30d: 518300, meGusta30d: 29400, compartidos30d: 3870 },
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
