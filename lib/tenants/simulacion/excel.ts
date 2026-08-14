// Guion de bandeja en vivo de Excel Automotriz (Toyota y las demás marcas).
// La agente NO da precios: los pasa al asesor. Ese límite se respeta aquí.
import type { TenantSimulacion } from "../types";

export const excelSimulacion: TenantSimulacion = {
  turnos: [
    {
      entra: "¿Tienen Hilux disponible?",
      responde:
        "Sí, tenemos Hilux en agencia. ¿La ocupa para trabajo o para uso familiar?",
    },
    {
      entra: "¿Cuánto cuesta la RAV4?",
      responde:
        "El precio se lo confirma el asesor con la promoción vigente. ¿Prefiere que le escriba o que le llame hoy?",
    },
    {
      entra: "Quiero cotizar una Corolla Cross.",
      responde: "Con gusto la vemos. ¿Le queda mejor que un asesor le llame o le escriba por aquí?",
    },
    {
      entra: "¿Hacen el mantenimiento de los 10 mil kilómetros?",
      responde: "Sí, en nuestros talleres y con repuesto original. ¿Para qué día le agendo?",
    },
    {
      entra: "¿Manejan otras marcas además de Toyota?",
      responde:
        "Sí: Chevrolet, Mitsubishi, KIA, BMW, MG y GEELY, entre otras. ¿Cuál está viendo?",
    },
    {
      entra: "¿Puedo aplicar a AutoFácil?",
      responde: "Claro, es nuestro financiamiento propio. ¿Le mando los requisitos?",
    },
    {
      entra: "¿Tienen sala de ventas en Santa Ana?",
      responde: "Sí, tenemos sala en Santa Ana. ¿Le queda mejor allí o en San Salvador?",
    },
    {
      entra: "Me interesa un usado con poco kilometraje.",
      responde:
        "Tenemos usados certificados con revisión completa. ¿Qué tipo de vehículo anda buscando?",
    },
    {
      entra: "¿Cuánto me dan por mi carro actual?",
      responde: "La valuación la hace el asesor viendo el vehículo, sin costo. ¿Cuándo puede pasar?",
    },
    {
      entra: "¿Atienden los sábados?",
      responde: "Sí, los sábados de 8 a 4. ¿Lo esperamos este fin de semana?",
    },
    {
      entra: "¿La camioneta viene con cámara de retroceso?",
      responde:
        "Sí, ese equipamiento viene de fábrica en esa versión. ¿Le agendo una prueba de manejo?",
    },
  ],
  contactos: [
    { nombre: "Rodrigo Cáceres", canal: "whatsapp", telefono: "50377205518", departamento: "ventas" },
    { nombre: "Mónica Zelaya", canal: "facebook", handle: "Mónica Zelaya" },
    { nombre: "Iván Guardado", canal: "instagram", handle: "@ivan.guardado", departamento: "usados" },
    { nombre: "Sonia Recinos", canal: "whatsapp", telefono: "50370883917", departamento: "taller" },
    { nombre: "Édgar Villalta", canal: "facebook", handle: "Édgar Villalta", departamento: "financiamiento" },
    { nombre: "Tatiana Merino", canal: "instagram", handle: "@tatimerino" },
    { nombre: "Héctor Cañas", canal: "whatsapp", telefono: "50376334480", departamento: "repuestos" },
  ],
};
