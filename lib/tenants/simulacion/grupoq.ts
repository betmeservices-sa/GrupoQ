// Guion de bandeja en vivo de Grupo Q (Nissan El Salvador).
// Disponibilidad de modelos, prima y cuota, usados, taller y repuestos.
import type { TenantSimulacion } from "../types";

export const grupoqSimulacion: TenantSimulacion = {
  turnos: [
    {
      entra: "Buenas, ¿tienen Frontier disponible en agencia?",
      responde:
        "Buenas, sí tenemos Frontier en existencia. ¿La está viendo para trabajo o para uso familiar?",
    },
    {
      entra: "¿De cuánto es la prima de la Kicks?",
      responde:
        "La prima arranca desde el 20 por ciento. ¿Quiere que le corra la cuota con financiamiento?",
    },
    {
      entra: "¿Manejan usados con garantía?",
      responde:
        "Sí, los certificados llevan revisión de 150 puntos y garantía. ¿Qué presupuesto tiene pensado?",
    },
    {
      entra: "Quiero dejar mi Sentra para el servicio.",
      responde: "Con gusto. ¿Cuántos kilómetros lleva y para qué día lo quiere dejar?",
    },
    {
      entra: "¿Tienen la Versa en color blanco?",
      responde: "Sí, hay Versa blanca en sala de exhibición. ¿Le agendo una prueba de manejo?",
    },
    {
      entra: "¿Aceptan mi carro como parte de pago?",
      responde: "Sí, se lo valuamos sin costo. ¿Qué modelo y año es el suyo?",
    },
    {
      entra: "¿Hasta qué hora abren hoy?",
      responde: "Hoy atendemos hasta las 6 de la tarde y mañana desde las 8. ¿Lo esperamos?",
    },
    {
      entra: "Necesito repuestos para una X-Trail 2019.",
      responde: "Manejamos repuesto original en existencia. ¿Qué pieza necesita?",
    },
    {
      entra: "¿Puedo aplicar a financiamiento con CrediQ?",
      responde: "Sí, y la aprobación sale el mismo día. ¿Le mando los requisitos?",
    },
    {
      entra: "¿Cuánto tarda el servicio de los 20 mil kilómetros?",
      responde:
        "Ese toma unas dos horas y media. ¿Le aparto cita para mañana temprano?",
    },
    {
      entra: "Vi el anuncio de la promoción de agosto, ¿sigue vigente?",
      responde:
        "Sí, sigue vigente este mes. ¿Qué modelo le interesa para pasarle las condiciones?",
    },
  ],
  contactos: [
    { nombre: "Josué Amaya", canal: "whatsapp", telefono: "50378442019", departamento: "ventas" },
    { nombre: "Claudia Marroquín", canal: "facebook", handle: "Claudia Marroquín" },
    { nombre: "Wilber Ramírez", canal: "instagram", handle: "@wilber.rmz", departamento: "usados" },
    { nombre: "Néstor Alfaro", canal: "whatsapp", telefono: "50371258834", departamento: "taller" },
    { nombre: "Gabriela Serrano", canal: "instagram", handle: "@gabyserrano.sv" },
    { nombre: "Luis Mancía", canal: "facebook", handle: "Luis Mancía", departamento: "repuestos" },
    { nombre: "Karla Beltrán", canal: "whatsapp", telefono: "50379016642", departamento: "crediq" },
  ],
};
