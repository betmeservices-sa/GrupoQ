// Guion de bandeja en vivo de Yali Hospitality (tres hoteles de playa).
// Lo que marca la diferencia con el resto de guiones: la PRIMERA respuesta del
// agente es siempre la pregunta de sede, y varios turnos muestran cómo se
// contesta ya sabiendo a cuál le escriben. También hay un turno de foto, porque
// este agente sí ve las imágenes.
//
// Los datos que se afirman acá son los que publica el hotel (check in a las
// 3 p.m., piscina, restaurante, parqueo, habitaciones por sede). Lo que no
// está confirmado (desayuno, salones, day pass) el agente lo deja al equipo,
// igual que en su guion real.
import type { TenantSimulacion } from "../types";
import { yalySucursales } from "../yaly-sucursales";

const [SEDE_A, SEDE_B, SEDE_C] = yalySucursales.opciones.map((o) => o.nombre);

export const yalySimulacion: TenantSimulacion = {
  turnos: [
    {
      entra: "Buenas, quiero información de habitaciones",
      responde:
        "¡Hola! Le saluda Sofía, de Yali Hospitality. Para atenderle bien, ¿a cuál de nuestros hoteles se comunica: A, B o C?",
    },
    {
      entra: "La A",
      responde: `Perfecto, ${SEDE_A}. ¿Para qué fechas necesita la habitación?`,
    },
    {
      entra: "Del viernes al domingo, somos dos",
      responde:
        "Con gusto. Para esas noches tengo Planta Alta vista al mar y Bungalow disponibles. ¿Le paso las dos con precio?",
    },
    {
      entra: "Le mando foto del cuarto que vi en Instagram",
      responde:
        "Ya la vi, es la Planta Alta frente al mar. Esa la tenemos en El Sunzal, ¿para qué noche la quiere?",
    },
    {
      entra: "¿Tienen algo para un grupo de 6?",
      responde: `Sí, el Bungalow Familiar recibe hasta 6. En ${SEDE_B} la Familiar también. ¿En cuál prefiere?`,
    },
    {
      entra: "¿Cuál queda más cerca de San Salvador?",
      responde: `${SEDE_C} está sobre la Carretera Litoral, es la más rápida de llegar. ¿Le reviso disponibilidad ahí?`,
    },
    {
      entra: "¿El desayuno viene incluido?",
      responde:
        "Se lo confirma el equipo hoy mismo para no darle un dato equivocado. Mientras tanto, ¿le aparto las fechas?",
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
        "Good morning! Yes, we do. Which of our three hotels are you writing about: A, B or C?",
    },
    {
      entra: "¿Puedo hacer check in temprano?",
      responde:
        "El check in es desde las 3:00 p.m.; si llega antes le guardamos el equipaje. ¿A qué hora llegaría?",
    },
    {
      entra: "Perfecto, resérvemela",
      responde:
        "Listo, su reserva quedó tomada y le llega la confirmación por aquí. ¡Le esperamos en la playa!",
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
