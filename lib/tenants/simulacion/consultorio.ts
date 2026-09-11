// Guion de la bandeja en vivo del Centro Médico San Benito.
//
// Es solo para el interruptor "En vivo" del demo: el motor inyecta estos turnos
// en el navegador para que la bandeja se vea con movimiento mientras se enseña.
// No llama al modelo ni cuesta tokens.
//
// Lo que preguntan en una clínica con laboratorio es casi siempre lo mismo:
// ayuno, precios, a qué hora toman muestra y si ya están los resultados.

import type { TenantSimulacion } from "../types";

export const consultorioSimulacion: TenantSimulacion = {
  contactos: [
    { nombre: "Ingrid Vásquez", canal: "whatsapp", telefono: "50378004512", departamento: "laboratorio" },
    { nombre: "Óscar Ramírez", canal: "whatsapp", telefono: "50371220984", departamento: "recepcion" },
    { nombre: "Wendy Alfaro", canal: "instagram", handle: "@wendy.alfaro", departamento: "recepcion" },
    { nombre: "Mario Escobar", canal: "facebook", handle: "Mario Escobar", departamento: "laboratorio" },
    { nombre: "Claudia Rivera", canal: "whatsapp", telefono: "50376331107", departamento: "consulta" },
  ],
  turnos: [
    {
      entra: "Buenos días, ¿necesito cita para hacerme exámenes o solo llego?",
      responde:
        "¡Buenos días! Para el laboratorio no necesita cita, puede llegar directo. Tomamos muestras de 6:30 a 10:00 a. m.",
    },
    {
      entra: "Me dejaron glucosa y colesterol. ¿Cuántas horas de ayuno?",
      responde: "Ocho horas de ayuno para los dos. Puede tomar agua, eso no lo afecta.",
    },
    {
      entra: "¿Cuánto sale el hemograma completo?",
      responde: "El hemograma completo cuesta $12. Si trae orden con varios exámenes le damos el precio del paquete.",
    },
    {
      entra: "¿Ya están mis resultados? Me los hice el martes.",
      responde:
        "Déjeme revisar con laboratorio. La mayoría salen el mismo día después de las 2 p. m., y se los podemos mandar al correo.",
    },
    {
      entra: "Quiero cita con la Dra. Morán para esta semana.",
      responde:
        "Con gusto. La doctora pasa consulta de lunes a viernes por la mañana. ¿Le queda mejor martes o jueves?",
    },
    {
      entra: "El jueves temprano.",
      responde:
        "Perfecto, le aparto el jueves a las 8:00 a. m. Le mando el enlace para que llene sus datos desde el teléfono y no haga fila.",
    },
    {
      entra: "¿Dónde quedan ustedes?",
      responde:
        "Tenemos dos sucursales: Escalón, frente al parque Beethoven, y Santa Tecla, sobre la avenida Manuel Gallardo. ¿Cuál le queda más cerca?",
    },
    {
      entra: "En Santa Tecla. ¿Atienden sábados?",
      responde: "Sí, en Santa Tecla atendemos de lunes a sábado de 7:00 a. m. a 4:00 p. m.",
    },
  ],
};
