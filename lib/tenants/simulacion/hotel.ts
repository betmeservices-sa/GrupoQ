// Guion de bandeja en vivo del hotel (El Descanso Antigua).
// Lo que de verdad le preguntan a un alojamiento: fechas libres, tarifa por
// noche, mascotas, hora de entrada y cómo llegar desde el aeropuerto.
import type { TenantSimulacion } from "../types";

export const hotelSimulacion: TenantSimulacion = {
  turnos: [
    {
      entra: "Buenas tardes, ¿tienen habitación libre para este fin de semana?",
      responde:
        "Buenas tardes, con gusto le reviso. ¿Llegarían el viernes y se quedan hasta el domingo?",
    },
    {
      entra: "¿Cuánto sale la noche para dos personas?",
      responde:
        "Para dos personas tengo la Habitación 3 en 480 quetzales la noche. ¿Se la aparto?",
    },
    {
      entra: "¿Aceptan mascotas? Viajo con mi perro.",
      responde:
        "Mascotas pequeñas sí las recibimos, en las casas del jardín. ¿Para qué fechas sería?",
    },
    {
      entra: "¿A qué hora puedo hacer el check in?",
      responde:
        "El check in es desde las 2 de la tarde y el check out hasta el mediodía. Si llega antes le guardamos el equipaje.",
    },
    {
      entra: "¿Cómo llego desde el aeropuerto?",
      responde:
        "Del aeropuerto son unos 50 minutos. Le coordinamos el traslado privado o le paso la ruta del shuttle, ¿qué prefiere?",
    },
    {
      entra: "Somos 6 personas, ¿tienen algo para quedarnos todos juntos?",
      responde:
        "Sí, la casa completa El Descanso 8 duerme hasta 8 personas, con 3 habitaciones. ¿Para qué fechas la ocupan?",
    },
    {
      entra: "¿Tienen parqueo dentro de la propiedad?",
      responde:
        "Sí, parqueo privado adentro y sin costo. ¿Le dejo apartado el espacio con su reserva?",
    },
    {
      entra: "Good evening, do you have rooms available in October?",
      responde:
        "Good evening! Yes, we still have rooms in October. Which dates would you be arriving?",
    },
    {
      entra: "¿La tarifa incluye desayuno?",
      responde:
        "La tarifa que le pasé es por noche e incluye café y pan de la casa por la mañana. ¿Le confirmo la reserva?",
    },
    {
      entra: "Si me cambia el vuelo, ¿puedo mover la reserva?",
      responde:
        "Eso lo revisa el equipo de reservas y hoy mismo se lo confirman. ¿Le aparto la habitación mientras tanto?",
    },
    {
      entra: "¿Tienen buena señal de wifi? Trabajo en línea.",
      responde:
        "Sí, hay fibra en toda la casa y escritorio en las habitaciones grandes. ¿Cuántas noches se quedaría?",
    },
    {
      entra: "Quiero sorprender a mi esposa por nuestro aniversario.",
      responde:
        "Qué lindo detalle. Podemos dejar la habitación preparada para su llegada. ¿Qué día sería la celebración?",
    },
  ],
  contactos: [
    { nombre: "Ana Lucía Godoy", canal: "whatsapp", telefono: "50245127788", departamento: "reservas" },
    { nombre: "Byron Chuc", canal: "facebook", handle: "Byron Chuc", departamento: "conserjeria" },
    { nombre: "Valeria Tzunún", canal: "instagram", handle: "@valeria.tzunun", departamento: "reservas" },
    { nombre: "Marvin Estuardo Pérez", canal: "whatsapp", telefono: "50257603311", departamento: "recepcion" },
    { nombre: "Emily Carter", canal: "instagram", handle: "@emily.carter.travels", departamento: "reservas" },
    { nombre: "Sucely Batz", canal: "facebook", handle: "Sucely Batz", departamento: "reservas" },
    { nombre: "Rodrigo Alvarado", canal: "whatsapp", telefono: "50241338920", departamento: "conserjeria" },
  ],
};
