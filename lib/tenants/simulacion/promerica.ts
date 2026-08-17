// Guion de bandeja en vivo de Banco Promerica.
// Lo que de verdad escribe alguien que se atrasó con un pago: cuánto debe, si
// le pueden dar plazo, por qué le aparece un cargo, y dónde paga.
import type { TenantSimulacion } from "../types";

export const promericaSimulacion: TenantSimulacion = {
  turnos: [
    {
      entra: "Buenos días, me llegó un mensaje de que estoy atrasado. ¿Cuánto tengo que pagar?",
      responde:
        "Buenos días. Con gusto se lo reviso. Por seguridad, ¿me confirma los últimos cuatro dígitos de su documento?",
    },
    {
      entra: "¿Hasta cuándo tengo para ponerme al día sin que me reporten?",
      responde:
        "Le puedo confirmar la fecha exacta de su cuenta. ¿Me confirma primero su documento, por favor?",
    },
    {
      entra: "Me pagan hasta el viernes. ¿Puedo pagar ese día?",
      responde:
        "Claro que sí. Le dejo anotado el compromiso para el viernes y le mandamos el recordatorio ese día.",
    },
    {
      entra: "Solo puedo abonar la mitad este mes.",
      responde:
        "Un abono también cuenta. ¿De cuánto estaríamos hablando y qué día lo haría?",
    },
    {
      entra: "¿Dónde puedo pagar sin ir a la agencia?",
      responde:
        "Puede hacerlo desde la banca en línea o la app, y también en los puntos de pago autorizados.",
    },
    {
      entra: "Me están cobrando algo que yo no reconozco.",
      responde:
        "Lo levantamos como reclamo de una vez. ¿Me indica el monto y la fecha del cargo que no reconoce?",
    },
    {
      entra: "Ya pagué ayer, ¿por qué me siguen escribiendo?",
      responde:
        "Puede que el pago aún no se refleje. ¿Me dice por qué canal lo hizo y a qué hora, para verificarlo?",
    },
    {
      entra: "Perdí el trabajo, no puedo pagar la cuota completa.",
      responde:
        "Lamento escuchar eso. Sí hay opciones para reordenar la cuota. ¿Le agendo que un asesor lo llame hoy?",
    },
    {
      entra: "¿Cuánto es mi saldo total?",
      responde:
        "Se lo reviso enseguida. ¿Me confirma los últimos cuatro dígitos de su documento, por favor?",
    },
    {
      entra: "No quiero que me llamen más al teléfono.",
      responde:
        "Entendido, lo registro y dejamos de llamarlo. Le seguimos escribiendo por acá si le parece bien.",
    },
    {
      entra: "¿Me pueden quitar los intereses si pago todo de una vez?",
      responde:
        "Eso lo revisa un asesor caso por caso. Con gusto le agendo la llamada para que se lo evalúen.",
    },
  ],
  contactos: [
    { nombre: "Mauricio Alexander Rivas", canal: "whatsapp", telefono: "50379908812", departamento: "cobranza" },
    { nombre: "Gaby Menéndez", canal: "instagram", handle: "@gaby.menendez" },
    { nombre: "Carlos Meléndez", canal: "facebook", handle: "Carlos Meléndez" },
    { nombre: "Xiomara Cruz de Peña", canal: "whatsapp", telefono: "50374882031", departamento: "cobranza" },
    { nombre: "Silvia Lorena Cáceres", canal: "whatsapp", telefono: "50378112360", departamento: "cobranza" },
    { nombre: "Andrea Sosa", canal: "instagram", handle: "@andreasosa.sv" },
    { nombre: "Nelson Bonilla", canal: "facebook", handle: "Nelson Bonilla" },
  ],
};
