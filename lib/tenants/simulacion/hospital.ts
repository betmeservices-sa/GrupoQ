// Guion de bandeja en vivo del hospital (Centro Ginecológico, El Salvador).
// Citas, precios de estudios, laboratorio, seguros y alguna urgencia.
import type { TenantSimulacion } from "../types";

export const hospitalSimulacion: TenantSimulacion = {
  turnos: [
    {
      entra: "Buenos días, quiero agendar una cita con ginecología.",
      responde: "Buenos días, con gusto le ayudo. ¿Prefiere por la mañana o por la tarde?",
    },
    {
      entra: "¿Cuánto cuesta el ultrasonido 4D?",
      responde:
        "El ultrasonido 4D está en 65 dólares e incluye las imágenes. ¿Le busco espacio para esta semana?",
    },
    {
      entra: "¿Necesito cita para los exámenes de laboratorio?",
      responde:
        "Para laboratorio no necesita cita: atendemos de 7 a 11 de la mañana, en ayunas. ¿La anoto para mañana?",
    },
    {
      entra: "Tengo 32 semanas y estoy sintiendo contracciones.",
      responde:
        "Vamos a atenderla de una vez. ¿Puede venir ahora a emergencia? Aviso al médico de turno para que la esperen.",
    },
    {
      entra: "¿Reciben seguro médico?",
      responde: "Sí, trabajamos con las principales aseguradoras. ¿Con cuál cuenta usted?",
    },
    {
      entra: "¿A qué hora pasa consulta la doctora?",
      responde: "Pasa consulta de 2 a 6 de la tarde. ¿Le aparto un espacio para hoy?",
    },
    {
      entra: "Necesito mover mi cita del jueves.",
      responde: "Con gusto se la cambio. ¿Para qué día le queda mejor?",
    },
    {
      entra: "¿Hacen control de niño sano?",
      responde:
        "Sí, pediatría atiende control de niño sano de lunes a sábado. ¿Qué edad tiene su bebé?",
    },
    {
      entra: "¿Cuándo entregan los resultados del laboratorio?",
      responde:
        "Los resultados salen el mismo día después de las 3 de la tarde y se los mandamos por aquí. ¿Le parece?",
    },
    {
      entra: "¿Puedo pagar con tarjeta?",
      responde: "Sí, en caja recibimos tarjeta y efectivo. ¿Le confirmo entonces su cita?",
    },
    {
      entra: "Quiero información sobre tratamiento de fertilidad.",
      responde:
        "Con gusto. La primera consulta es con la especialista en reproducción asistida. ¿Le busco cita esta semana?",
    },
  ],
  contactos: [
    { nombre: "Yesenia Portillo", canal: "whatsapp", telefono: "50378229044", departamento: "ginecologia" },
    { nombre: "Rosa Elena Cañas", canal: "facebook", handle: "Rosa Elena Cañas" },
    { nombre: "Kimberly López", canal: "instagram", handle: "@kimberly.lopezz", departamento: "obstetricia" },
    { nombre: "Doris Hernández de Cruz", canal: "whatsapp", telefono: "50370448831", departamento: "laboratorio" },
    { nombre: "Mario Alvarenga", canal: "whatsapp", telefono: "50376550213", departamento: "pediatria" },
    { nombre: "Fátima Escobar", canal: "instagram", handle: "@fati.escobar" },
    { nombre: "Silvia Rodríguez", canal: "facebook", handle: "Silvia Rodríguez" },
  ],
};
