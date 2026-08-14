// Guion de bandeja en vivo de la inmobiliaria (Terrazul, El Salvador).
// Lo que preguntan los interesados: si la propiedad sigue disponible, prima,
// FSV o banco, metros del terreno y cuándo se puede visitar.
import type { TenantSimulacion } from "../types";

export const inmobiliariaSimulacion: TenantSimulacion = {
  turnos: [
    {
      entra: "Buenos días, vi la casa de Santa Tecla en Facebook. ¿Todavía está disponible?",
      responde:
        "Buenos días, sí está disponible. ¿La está buscando para comprar o para alquilar?",
    },
    {
      entra: "¿De cuánto es la prima de la casa de Merliot?",
      responde:
        "En esa propiedad la prima ronda el 10 por ciento. ¿Ya tiene aprobación de banco o va con el FSV?",
    },
    {
      entra: "¿Aceptan crédito del Fondo Social para la Vivienda?",
      responde:
        "Sí, esa califica para FSV y la escritura ya está inscrita. ¿Le agendo la visita?",
    },
    {
      entra: "¿De cuántas varas es el terreno?",
      responde:
        "Son 210 varas cuadradas, con muro perimetral completo. ¿Le mando la ubicación para que lo vea?",
    },
    {
      entra: "Ando buscando apartamento en alquiler por la Escalón.",
      responde: "Con gusto le busco. ¿Hasta cuánto tiene pensado pagar de renta al mes?",
    },
    {
      entra: "¿Se puede visitar el sábado?",
      responde:
        "Sí, el sábado hay agenda desde las 9. ¿Le queda mejor por la mañana o por la tarde?",
    },
    {
      entra: "¿La casa tiene cuarto de servicio?",
      responde:
        "Sí, tiene cuarto y baño de servicio, más dos parqueos techados. ¿Quiere verla esta semana?",
    },
    {
      entra: "Quiero poner mi casa en venta con ustedes.",
      responde: "Con gusto la tomamos. ¿En qué zona está y cuántas habitaciones tiene?",
    },
    {
      entra: "¿De cuánto quedaría la cuota mensual con el banco?",
      responde:
        "A 20 años de plazo la cuota anda por los 1,180 dólares. ¿Le corro el cálculo con la prima que tiene?",
    },
    {
      entra: "¿La escritura está limpia?",
      responde:
        "Sí, inscrita y libre de gravamen. Nuestra área de trámites revisa todo antes de la firma.",
    },
    {
      entra: "¿Cuánto piden por el local del Paseo El Carmen?",
      responde:
        "Ese lo manejamos en alquiler, con contrato mínimo de un año. ¿Para qué tipo de negocio lo ocupa?",
    },
  ],
  contactos: [
    { nombre: "Marvin Alexander Rivas", canal: "whatsapp", telefono: "50376113420" },
    { nombre: "Gaby Menéndez", canal: "instagram", handle: "@gaby.menendez" },
    { nombre: "Carlos Meléndez", canal: "facebook", handle: "Carlos Meléndez" },
    { nombre: "Xiomara Cruz de Peña", canal: "whatsapp", telefono: "50372560091" },
    { nombre: "Óscar Iraheta", canal: "whatsapp", telefono: "50379334412", departamento: "captacion" },
    { nombre: "Andrea Sosa", canal: "instagram", handle: "@andreasosa.sv" },
    { nombre: "Nelson Bonilla", canal: "facebook", handle: "Nelson Bonilla" },
  ],
};
