// Datos base del tenant "yaly" (Yali Hospitality, tres hoteles de playa).
//
// Yali ES UN CLIENTE EN PRODUCCIÓN, no un demo: acá NO van conversaciones,
// contactos, publicaciones ni métricas de mentira. La bandeja arranca vacía y
// se llena con lo que de verdad entra por Messenger, Instagram y WhatsApp.
//
// Lo único que queda escrito es la estructura: los departamentos, las personas
// reales del equipo y los canales internos. Eso no es dato inventado, es cómo
// está organizado el hotel.
//
// Si alguien vuelve a agregar una conversación de ejemplo acá, va a aparecer en
// la pantalla de Verónica mezclada con huéspedes reales.
//
// OJO: los nombres de sucursal que aparecen abajo salen de
// lib/tenants/yaly-sucursales.ts, que es el único lugar donde se editan.

import type { TenantSeed } from "../types";
import { yalySucursales } from "../yaly-sucursales";

const ME = "me";
const [SUC_A, SUC_B, SUC_C] = yalySucursales.opciones.map((o) => o.nombre);

export const yalySeed: TenantSeed = {
  ME,
  // Membresías es un departamento aparte y no un sabor de ventas. Jaime lo dijo
  // así en el kickoff: "reservas es la banca tradicional y membresía es banca
  // privada". Quien atiende socios no atiende reservas y al revés.
  departments: [
    { id: "reservas", nombre: "Reservas", color: "#0e7490" },
    { id: "membresias", nombre: "Membresías", color: "#b45309" },
    { id: "recepcion", nombre: "Recepción", color: "#7c3aed" },
    { id: "conserjeria", nombre: "Conserjería", color: "#2e9e5b" },
    { id: "atencion", nombre: "Atención al Huésped", color: "#64748b" },
  ],
  // Las personas que pidieron usuario en el kickoff del 24 de agosto de 2026.
  staff: [
    { id: ME, nombre: "Gerente de Marketing", rol: "gerente_marketing", departamento: "atencion", iniciales: "GM" },
    { id: "s2", nombre: "Verónica Viches", rol: "medico", departamento: "reservas", iniciales: "VV" },
    { id: "s3", nombre: "Olga", rol: "marketing", departamento: "membresias", iniciales: "OL" },
    { id: "s4", nombre: "Jaime Quintanilla", rol: "jefe", departamento: "reservas", iniciales: "JQ" },
    { id: "s5", nombre: "Dino Safie", rol: "jefe", departamento: "atencion", iniciales: "DS" },
    { id: "s6", nombre: "José Mauricio", rol: "recepcion", departamento: "recepcion", iniciales: "JM" },
  ],
  contacts: [],
  conversations: [],
  messages: [],
  internalChannels: [
    { id: "ic1", nombre: "general", tipo: "canal", miembros: [ME, "s2", "s3", "s4", "s5", "s6"] },
    { id: "ic2", nombre: "reservas", tipo: "canal", miembros: [ME, "s2", "s4"] },
    { id: "ic3", nombre: "hoteles", tipo: "canal", miembros: [ME, "s3", "s4", "s6"] },
    { id: "ic4", nombre: "membresias", tipo: "canal", miembros: [ME, "s3", "s4"] },
    { id: "dm1", nombre: "Jaime Quintanilla", tipo: "dm", miembros: [ME, "s4"] },
    { id: "dm2", nombre: "Olga", tipo: "dm", miembros: [ME, "s3"] },
  ],
  internalMessages: [],
  socialPosts: [],
  socialStats: [],
  metrics: [],
};
