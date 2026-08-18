// Guion de bandeja en vivo de Hotel Yaly (3 sucursales).
// Lo que marca la diferencia con el resto de guiones: la PRIMERA respuesta del
// agente es siempre la pregunta de sucursal, y varios turnos muestran cómo se
// contesta ya sabiendo a cuál sede le escriben. También hay un turno de foto,
// porque este agente sí ve las imágenes.
import type { TenantSimulacion } from "../types";
import { yalySucursales } from "../yaly-sucursales";

const [SUC_A, SUC_B, SUC_C] = yalySucursales.opciones.map((o) => o.nombre);

export const yalySimulacion: TenantSimulacion = {
  turnos: [
    {
      entra: "Buenas, quiero información de habitaciones",
      responde:
        "¡Hola! Le saluda Renata, de Hotel Yaly. Para atenderle bien, ¿a cuál de nuestras sucursales se comunica: A, B o C?",
    },
    {
      entra: "La A",
      responde: `Perfecto, ${SUC_A}. ¿Para qué fechas necesita la habitación?`,
    },
    {
      entra: "¿Cuánto sale la noche para dos personas?",
      responde:
        "Para dos personas la habitación doble sale a la tarifa de temporada. ¿Se la reservo para esas fechas?",
    },
    {
      entra: "Le mando foto del cuarto que vi en Instagram",
      responde:
        "Ya la vi, es la habitación con balcón y vista al jardín. La tenemos en esa sede, ¿para qué noche la quiere?",
    },
    {
      entra: "¿Tienen salón para un evento de 60 personas?",
      responde: `En ${SUC_B} el salón recibe hasta 80 personas. ¿Qué día sería el evento?`,
    },
    {
      entra: "¿Cuál de las tres queda más cerca del centro?",
      responde: `${SUC_C} es la más céntrica. ¿Le paso disponibilidad de esa sede?`,
    },
    {
      entra: "¿El desayuno viene incluido?",
      responde:
        "Sí, el desayuno va incluido en todas nuestras sedes. ¿Le confirmo la reserva?",
    },
    {
      entra: "Necesito factura a nombre de la empresa",
      responde:
        "Sin problema, la emitimos a nombre de la empresa. ¿Me comparte el nombre y el número de registro?",
    },
    {
      entra: "¿Tienen parqueo?",
      responde:
        "Sí, parqueo propio y sin costo para huéspedes. ¿Cuántas noches se quedaría?",
    },
    {
      entra: "Good morning, do you have rooms for next week?",
      responde:
        "Good morning! Yes, we do. Which of our three locations are you writing about: A, B or C?",
    },
    {
      entra: "¿Puedo hacer check in temprano?",
      responde:
        "El check in es desde la 1:00 p.m.; si llega antes le guardamos el equipaje. ¿A qué hora llegaría?",
    },
    {
      entra: "Somos 5 y queremos quedarnos juntos",
      responde:
        "Tenemos habitaciones conectadas para grupos. ¿Para qué fechas las necesita?",
    },
  ],
  contactos: [
    { nombre: "Karla Villalta", canal: "whatsapp", telefono: "50376221190", departamento: "reservas" },
    { nombre: "Nelson Aguirre", canal: "facebook", handle: "Nelson Aguirre", departamento: "conserjeria" },
    { nombre: "Daniela Rivas", canal: "instagram", handle: "@dani.rivas", departamento: "reservas" },
    { nombre: "Fernando Ayala", canal: "whatsapp", telefono: "50361447752", departamento: "recepcion" },
    { nombre: "Sarah Nolan", canal: "instagram", handle: "@sarah.nolan", departamento: "reservas" },
    { nombre: "Grupo Ferretero SA", canal: "facebook", handle: "Grupo Ferretero SA", departamento: "atencion" },
    { nombre: "Wilfredo Chacón", canal: "whatsapp", telefono: "50372089943", departamento: "conserjeria" },
  ],
};
