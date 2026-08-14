// Guion de bandeja en vivo de MiAgentIA (agencia de agentes de IA).
// Preguntan dueños de negocio: qué hace el agente, si sirve para su rubro,
// cuánto cuesta y en cuánto tiempo queda listo.
import type { TenantSimulacion } from "../types";

export const miagentiaSimulacion: TenantSimulacion = {
  turnos: [
    {
      entra: "Hola, vi el anuncio del agente de WhatsApp. ¿Cómo funciona?",
      responde:
        "Hola, con gusto le explico. El agente contesta sus mensajes al instante, las 24 horas. ¿Qué tipo de negocio tiene?",
    },
    {
      entra: "¿Sirve para una clínica dental?",
      responde:
        "En clínicas es donde más se nota: agenda citas y manda los recordatorios sola. ¿Cuántos mensajes recibe al día?",
    },
    {
      entra: "¿Cuánto cuesta al mes?",
      responde:
        "Depende del volumen de conversaciones. ¿Le paso los planes por aquí o prefiere una llamada de 15 minutos?",
    },
    {
      entra: "¿También contesta llamadas?",
      responde:
        "Sí, el agente de voz atiende y transfiere cuando toca. ¿Quiere escuchar una demostración?",
    },
    {
      entra: "¿En cuánto tiempo lo tienen listo?",
      responde:
        "En una semana queda funcionando con la información de su negocio. ¿Cuándo le gustaría arrancar?",
    },
    {
      entra: "¿Se conecta con mi sistema de citas?",
      responde: "Sí, se conecta con su calendario y con su CRM. ¿Cuál usa hoy?",
    },
    {
      entra: "¿Puede atender en inglés también?",
      responde:
        "Sí, cambia de idioma según le escriban. ¿Atiende clientes fuera del país?",
    },
    {
      entra: "Tengo 3 sucursales, ¿se pueden separar?",
      responde:
        "Sí, cada sucursal con su bandeja y su equipo. ¿Cuántas personas atienden hoy los mensajes?",
    },
    {
      entra: "¿Un humano puede tomar el chat cuando quiera?",
      responde:
        "Cuando quiera: el agente se pausa y su equipo sigue la conversación desde la misma bandeja. ¿Le muestro cómo se ve?",
    },
    {
      entra: "¿Y si el cliente pregunta algo que el agente no sabe?",
      responde:
        "No inventa: avisa que lo confirma y le pasa el chat a una persona. ¿Quiere ver un ejemplo real?",
    },
    {
      entra: "Me interesa, ¿qué necesitan de mi parte para empezar?",
      responde:
        "Solo su información de servicios y precios, más el acceso al número. ¿Le agendo la reunión de arranque?",
    },
  ],
  contactos: [
    { nombre: "Erick Portillo", canal: "whatsapp", telefono: "50378110394", departamento: "ventas" },
    { nombre: "Marisol Aguilar", canal: "facebook", handle: "Marisol Aguilar" },
    { nombre: "Cristian Girón", canal: "instagram", handle: "@cristian.giron.gt", departamento: "ventas" },
    { nombre: "Lourdes Campos", canal: "whatsapp", telefono: "50241772305", departamento: "onboarding" },
    { nombre: "Fernando Baires", canal: "instagram", handle: "@fer.baires" },
    { nombre: "Ingrid Palacios", canal: "facebook", handle: "Ingrid Palacios", departamento: "soporte" },
    { nombre: "Álvaro Contreras", canal: "whatsapp", telefono: "50372448170", departamento: "ventas" },
  ],
};
