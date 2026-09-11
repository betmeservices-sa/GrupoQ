// Datos semilla del tenant "consultorio" — Centro Médico San Benito.
//
// Una clínica chica con laboratorio propio: dos doctores que pasan consulta y
// dos sucursales donde se toman las muestras. Lo que la distingue de los otros
// demos es que aquí el paciente se registra solo, escaneando un QR, y el
// expediente, la receta y la orden de exámenes viven en la misma app.
//
// Español salvadoreño. Timestamps fijos (sin Date.now) para que el demo se vea
// igual cada vez que se abre. Las personas son inventadas.

import type { TenantSeed } from "../types";

const ME = "me";

export const consultorioSeed: TenantSeed = {
  ME,
  departments: [
    { id: "consulta", nombre: "Consulta", color: "#0e7c6b" },
    { id: "laboratorio", nombre: "Laboratorio", color: "#0067a8" },
    { id: "imagenes", nombre: "Imágenes", color: "#7c3aed" },
    { id: "recepcion", nombre: "Recepción", color: "#64748b" },
  ],
  staff: [
    { id: ME, nombre: "Administración", rol: "gerente_marketing", departamento: "recepcion", iniciales: "AD" },
    { id: "s2", nombre: "Dra. Alejandra Morán", rol: "medico", departamento: "consulta", iniciales: "AM" },
    { id: "s3", nombre: "Dr. Ernesto Rivas", rol: "medico", departamento: "consulta", iniciales: "ER" },
    { id: "s4", nombre: "Lic. Karla Cruz", rol: "jefe", departamento: "laboratorio", iniciales: "KC" },
    { id: "s5", nombre: "Lic. Mauricio Solís", rol: "recepcion", departamento: "laboratorio", iniciales: "MS" },
    { id: "s6", nombre: "Gabriela Menjívar", rol: "recepcion", departamento: "recepcion", iniciales: "GM" },
    { id: "s7", nombre: "Dr. Iván Zelaya", rol: "medico", departamento: "imagenes", iniciales: "IZ" },
  ],
  contacts: [
    { id: "c1", nombre: "Marta Elena Guzmán", telefono: "50377124455", correo: "marta.guzman@gmail.com", canal: "whatsapp", notas: "Control de diabetes con la Dra. Morán. Le tocan hemoglobina glicosilada y química cada tres meses.", tags: ["Exámenes de laboratorio"] },
    { id: "c2", nombre: "Rodrigo Peña", telefono: "50370338891", correo: "rodrigo.pena@outlook.com", canal: "whatsapp", notas: "Chequeo anual de la empresa. Pidió que le manden los resultados por correo.", tags: ["Chequeo anual"] },
    { id: "c3", nombre: "Silvia Menjívar de Cruz", telefono: "50360882210", correo: "silvia.menjivar@gmail.com", canal: "whatsapp", notas: "Vino con orden del cardiólogo. Solo se hizo cinco de los siete exámenes, le falta el perfil lipídico.", tags: ["Exámenes pendientes"] },
    { id: "c4", nombre: "Ana Cecilia Portillo", handle: "@anace.portillo", canal: "instagram", notas: "Preguntó por el chequeo prenatal. Se le pasó el número de recepción.", tags: ["Cita de consulta"] },
    { id: "c5", nombre: "Julio Barahona", handle: "Julio Barahona", canal: "facebook", notas: "Consultó precio del hemograma y si necesita ayuno.", tags: ["Precios"] },
    { id: "c6", nombre: "Nelson Cruz Aguilar", telefono: "50371193358", correo: "nelson.cruz@gmail.com", canal: "whatsapp", notas: "Resultados listos desde el martes, no ha pasado a recogerlos.", tags: ["Resultados"] },

    { id: "c7", nombre: "Xiomara Alfaro", telefono: "50374882031", canal: "whatsapp", notas: "Paciente de la Dra. Morán desde hace años. Siempre agenda por WhatsApp.", tags: ["Cita de consulta"] },
    { id: "c8", nombre: "Carlos Ernesto Sibrián", telefono: "50372338814", correo: "csibrian@gmail.com", canal: "whatsapp", notas: "Le corresponde control de presión con el Dr. Rivas cada seis meses.", tags: ["Cita de consulta"] },
    { id: "c9", nombre: "Doris Quintanilla", telefono: "50378112360", canal: "whatsapp", notas: "Pregunta seguido por preparación de exámenes. Prefiere que le expliquen por audio.", tags: ["Exámenes de laboratorio"] },
    { id: "c10", nombre: "Fernando Aguirre", telefono: "50376990412", correo: "faguirre@pymesv.com", canal: "whatsapp", notas: "Trae al personal de su empresa a chequeo. Pide factura a nombre de la empresa.", tags: ["Chequeo anual"] },
  ],
  conversations: [
    { id: "v1", canal: "whatsapp", contactId: "c1", departamento: "laboratorio", estado: "en_progreso", asignadoA: "s4", noLeidos: 1, ultimoMensajeTs: "2026-09-08T09:34:00" },
    { id: "v2", canal: "whatsapp", contactId: "c2", departamento: "recepcion", estado: "en_progreso", asignadoA: "s6", noLeidos: 0, ultimoMensajeTs: "2026-09-08T09:05:00" },
    { id: "v3", canal: "whatsapp", contactId: "c3", departamento: "laboratorio", estado: "nuevo", noLeidos: 2, ultimoMensajeTs: "2026-09-08T08:41:00" },
    { id: "v4", canal: "instagram", contactId: "c4", departamento: "recepcion", estado: "nuevo", noLeidos: 1, ultimoMensajeTs: "2026-09-07T19:12:00" },
    { id: "v5", canal: "facebook", contactId: "c5", departamento: "recepcion", estado: "resuelto", asignadoA: "s6", noLeidos: 0, ultimoMensajeTs: "2026-09-07T16:28:00" },
    { id: "v6", canal: "whatsapp", contactId: "c6", departamento: "laboratorio", estado: "en_progreso", asignadoA: "s5", noLeidos: 0, ultimoMensajeTs: "2026-09-06T11:50:00" },
  ],
  messages: [
    { id: "m1", conversationId: "v1", autor: "cliente", texto: "Buenos días, la doctora me dejó unos exámenes. ¿Puedo llegar mañana en ayunas?", ts: "2026-09-08T09:28:00" },
    { id: "m2", conversationId: "v1", autor: "staff", staffId: "ia", texto: "¡Buenos días doña Marta! Sí, puede llegar mañana. Para la glucosa y el perfil lipídico necesita ayuno de 8 horas, puede tomar agua.", ts: "2026-09-08T09:29:00" },
    { id: "m3", conversationId: "v1", autor: "cliente", texto: "Perfecto. ¿Y hasta qué hora toman muestras?", ts: "2026-09-08T09:33:00" },
    { id: "m4", conversationId: "v1", autor: "staff", staffId: "s4", texto: "Hasta las 10 de la mañana en Escalón, doña Marta. Si llega antes de las 8 sale más rápido.", ts: "2026-09-08T09:34:00" },

    { id: "m5", conversationId: "v2", autor: "cliente", texto: "Buenos días, necesito el chequeo anual que pide mi empresa. ¿Qué incluye?", ts: "2026-09-08T09:01:00" },
    { id: "m6", conversationId: "v2", autor: "staff", staffId: "ia", texto: "Buenos días. El chequeo anual incluye consulta, hemograma completo, glucosa, perfil lipídico y examen general de orina. ¿Le agendo la consulta esta semana?", ts: "2026-09-08T09:02:00" },
    { id: "m7", conversationId: "v2", autor: "cliente", texto: "Sí, el jueves temprano si se puede.", ts: "2026-09-08T09:04:00" },
    { id: "m8", conversationId: "v2", autor: "staff", staffId: "s6", texto: "Listo don Rodrigo, jueves a las 7:30 con el Dr. Rivas. Le mandamos el enlace para que llene sus datos antes de venir.", ts: "2026-09-08T09:05:00" },

    { id: "m9", conversationId: "v3", autor: "cliente", texto: "Ayer solo me hicieron cinco exámenes de los siete que traía.", ts: "2026-09-08T08:39:00" },
    { id: "m10", conversationId: "v3", autor: "cliente", texto: "¿Tengo que volver a sacar cita o solo llego?", ts: "2026-09-08T08:41:00" },

    { id: "m11", conversationId: "v4", autor: "cliente", texto: "Hola, buenas. ¿Hacen control prenatal ahí?", ts: "2026-09-07T19:12:00" },

    { id: "m12", conversationId: "v5", autor: "cliente", texto: "Buenas tardes, ¿cuánto cuesta el hemograma y necesito ayuno?", ts: "2026-09-07T16:22:00" },
    { id: "m13", conversationId: "v5", autor: "staff", staffId: "ia", texto: "Buenas tardes. El hemograma completo cuesta $12 y no necesita ayuno. Si en la misma visita le van a hacer glucosa, ahí sí se pide ayuno de 8 horas.", ts: "2026-09-07T16:23:00" },
    { id: "m14", conversationId: "v5", autor: "cliente", texto: "Gracias, paso mañana entonces.", ts: "2026-09-07T16:28:00" },

    { id: "m15", conversationId: "v6", autor: "staff", staffId: "s5", texto: "Don Nelson, sus resultados están listos desde el martes. Se los podemos mandar por correo si prefiere.", ts: "2026-09-06T11:48:00" },
    { id: "m16", conversationId: "v6", autor: "cliente", texto: "Sí por favor, al correo. Paso por el original el fin de semana.", ts: "2026-09-06T11:50:00" },
  ],
  internalChannels: [
    { id: "ic1", nombre: "general", tipo: "canal", miembros: [ME, "s2", "s3", "s4", "s5", "s6", "s7"] },
    { id: "ic2", nombre: "laboratorio", tipo: "canal", miembros: ["s4", "s5", "s6"] },
    { id: "ic3", nombre: "consulta", tipo: "canal", miembros: [ME, "s2", "s3", "s7"] },
    { id: "dm1", nombre: "Dra. Alejandra Morán", tipo: "dm", miembros: [ME, "s2"] },
  ],
  internalMessages: [
    { id: "im1", channelId: "ic1", staffId: "s6", texto: "Buenos días. Hoy tenemos jornada de chequeo de empresa, van a llegar unas 20 personas entre 7 y 9.", ts: "2026-09-08T06:50:00" },
    { id: "im2", channelId: "ic1", staffId: "s4", texto: "Anotado. Dejamos dos personas tomando muestra en Escalón desde las 6:30.", ts: "2026-09-08T06:58:00" },
    { id: "im3", channelId: "ic2", staffId: "s5", texto: "Se nos acumuló la fila a las 8, siete personas esperando. Ya bajó.", ts: "2026-09-08T08:20:00" },
    { id: "im4", channelId: "ic2", staffId: "s4", texto: "Si vuelve a pasar de diez minutos de espera, me avisás y mandamos a alguien de recepción a apoyar.", ts: "2026-09-08T08:25:00" },
    { id: "im5", channelId: "ic3", staffId: "s2", texto: "Recuerden imprimir el QR nuevo para la sala de espera, el de la pared quedó viejo.", ts: "2026-09-07T15:10:00" },
    { id: "im6", channelId: "ic3", staffId: "s3", texto: "Ya lo mandé a imprimir. Va uno en cada consultorio.", ts: "2026-09-07T15:22:00" },
    { id: "im7", channelId: "dm1", staffId: "s2", texto: "¿Me pueden pasar cuántos pacientes se registraron por el código esta semana?", ts: "2026-09-08T10:02:00" },
    { id: "im8", channelId: "dm1", staffId: ME, texto: "Claro doctora, van 34. Le paso el detalle al mediodía.", ts: "2026-09-08T10:06:00" },
  ],
  socialPosts: [
    { id: "sp1", red: "instagram", estado: "publicado", texto: "Ya no hay que llenar papeles en la sala de espera. Escaneá el código de tu doctor y quedás registrado antes de pasar.", fecha: "2026-09-06T09:00:00", engagement: { alcance: 6120, meGusta: 388, comentarios: 24, compartidos: 31, guardados: 74 } },
    { id: "sp2", red: "facebook", estado: "publicado", texto: "Laboratorio abierto de lunes a viernes desde las 6:30 a. m. Llegá en ayunas y salís antes de entrar a trabajar.", fecha: "2026-09-05T15:00:00", engagement: { alcance: 9840, meGusta: 402, comentarios: 41, compartidos: 88 } },
    { id: "sp3", red: "instagram", estado: "programado", texto: "Chequeo anual completo: consulta, hemograma, glucosa, perfil lipídico y orina. Agendá por mensaje.", fecha: "2026-09-11T10:00:00" },
    { id: "sp4", red: "facebook", estado: "borrador", texto: "¿Por qué te piden ayuno para algunos exámenes y para otros no? Te lo explicamos en dos minutos.", fecha: "2026-09-10T12:00:00" },
  ],
  socialStats: [
    { red: "instagram", handle: "@centromedicosanbenito", seguidores: 9240, nuevosSeguidores: 312, crecimientoPct: 3.5, alcance30d: 28400, vistas30d: 61200, interacciones30d: 3410 },
    { red: "facebook", handle: "Centro Médico San Benito", seguidores: 16800, nuevosSeguidores: 268, crecimientoPct: 1.6, alcance30d: 41300, vistas30d: 88500, interacciones30d: 4980 },
  ],
  metrics: [
    { label: "Conversaciones hoy", valor: 24, delta: 9 },
    { label: "Tiempo de respuesta", valor: "4 min", delta: -22 },
    { label: "Citas agendadas", valor: 11, delta: 15 },
    { label: "Atendidas por IA", valor: "68%", delta: 6 },
  ],
};
