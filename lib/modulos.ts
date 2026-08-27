// Que ve cada rol y en que ruta vive cada modulo.
//
// Va aparte de roles.ts porque esto TAMBIEN corre en el servidor: el middleware
// lo usa para cerrar la puerta de verdad. roles.ts es "use client" y ademas lee
// las etiquetas del tenant activo, asi que no se puede importar desde ahi.
//
// La distincion importa: el menu que no muestra un modulo es comodidad; lo que
// impide entrar escribiendo la URL a mano es esto.

import type { RoleId } from "./data/types";

export type ModuleId =
  | "bandeja"
  | "mis-chats"
  | "tickets"
  | "hoy"
  | "contactos"
  | "habitaciones"
  | "calendario"
  | "pipeline"
  | "visitas"
  | "cartera"
  | "publicacion"
  | "cobros"
  | "campanas"
  | "interno"
  | "redes"
  | "comentarios"
  | "promociones"
  | "perfil"
  // Probar a Sofía: un chat de prueba contra el guion real (solo Yali).
  | "sofia"
  | "dashboard"
  | "llamadas"
  | "agentes"
  | "settings";

export interface RoleDef {
  id: RoleId;
  nombre: string;
  ve: ModuleId[];
}

// Qué módulos ve cada rol (igual para todos los tenants):
//   Recepción       -> Bandeja + Chat interno
//   Marketing       -> Bandeja + Redes sociales
//   Dirección       -> todo
//   Gerente de Mkt. -> todo
// Médico/Asesor y Jefe mantienen su acceso operativo (bandeja/interno/dashboard).
// "hoy", "habitaciones" y "calendario" solo existen en el tenant del hotel (el
// Sidebar los filtra); los roles que atienden al huésped los ven, marketing no.
// "pipeline", "visitas", "cartera" y "publicacion" solo existen en la
// inmobiliaria: el pipeline y las visitas son de quien vende (marketing no ve
// los leads ni la agenda), y la publicación la arman tanto el asesor como
// marketing, porque los dos suben anuncios.
// "mis-chats", "promociones" y "perfil" solo existen en Yali Hospitality. Las
// promociones alimentan en vivo lo que el agente puede ofrecer, así que las ve
// también marketing; el perfil del agente lo tocan solo dirección y jefatura.
// "comentarios" es la otra mitad de la bandeja: lo que preguntan en publico
// debajo de las publicaciones. Lo ve quien atiende y quien lleva las redes.
// "tickets" es el tablero de casos que el agente no resuelve solo. Lo trabajan
// quienes atienden (recepcion, medico) y lo mira jefatura por las metricas;
// marketing no gestiona casos, asi que no lo ve.
// "mis-chats" lo ve todo el mundo: es donde caen los chats que el agente pasa a
// una persona, y quien atiende tiene que verlos sin depender de su rol.
const TODO: ModuleId[] = ["bandeja", "mis-chats", "tickets", "hoy", "contactos", "habitaciones", "calendario", "pipeline", "visitas", "cartera", "publicacion", "cobros", "campanas", "interno", "redes", "comentarios", "promociones", "perfil", "sofia", "dashboard", "llamadas", "agentes", "settings"];
export const VE: Record<RoleId, ModuleId[]> = {
  recepcion: ["bandeja", "mis-chats", "tickets", "hoy", "contactos", "habitaciones", "calendario", "pipeline", "visitas", "cartera", "interno", "comentarios"],
  // Solo contestar: los mensajes privados y lo publico de las redes. Nada de
  // metricas, ajustes, promociones ni perfil del agente.
  atencion: ["bandeja", "mis-chats", "comentarios", "redes"],
  marketing: ["bandeja", "mis-chats", "contactos", "cartera", "publicacion", "cobros", "redes", "comentarios", "promociones"],
  gerente_marketing: TODO,
  medico: ["bandeja", "mis-chats", "tickets", "hoy", "contactos", "habitaciones", "calendario", "pipeline", "visitas", "cartera", "publicacion", "cobros", "campanas", "interno"],
  jefe: ["bandeja", "mis-chats", "tickets", "hoy", "contactos", "habitaciones", "calendario", "pipeline", "visitas", "cartera", "publicacion", "cobros", "interno", "redes", "comentarios", "promociones", "perfil", "sofia", "dashboard"],
  admin: TODO,
};


// Ruta de cada modulo (para navegar / redirigir).
export const MODULO_RUTA: Record<ModuleId, string> = {
  bandeja: "/",
  "mis-chats": "/mis-chats",
  tickets: "/tickets",
  hoy: "/hoy",
  contactos: "/contactos",
  habitaciones: "/habitaciones",
  calendario: "/calendario",
  pipeline: "/pipeline",
  visitas: "/visitas",
  cartera: "/cartera",
  publicacion: "/publicacion",
  cobros: "/cobros",
  campanas: "/campanas",
  interno: "/interno",
  redes: "/redes",
  comentarios: "/comentarios",
  promociones: "/promociones",
  perfil: "/perfil",
  sofia: "/sofia",
  dashboard: "/dashboard",
  llamadas: "/llamadas",
  agentes: "/agentes",
  settings: "/settings",
};

// Que modulo corresponde a una ruta. null = ruta sin modulo (no se restringe).
export function moduloDeRuta(pathname: string): ModuleId | null {
  if (pathname === "/") return "bandeja";
  if (pathname.startsWith("/mis-chats")) return "mis-chats";
  if (pathname.startsWith("/tickets")) return "tickets";
  if (pathname.startsWith("/hoy")) return "hoy";
  if (pathname.startsWith("/contactos")) return "contactos";
  if (pathname.startsWith("/habitaciones")) return "habitaciones";
  if (pathname.startsWith("/calendario")) return "calendario";
  if (pathname.startsWith("/pipeline")) return "pipeline";
  if (pathname.startsWith("/visitas")) return "visitas";
  if (pathname.startsWith("/cartera")) return "cartera";
  if (pathname.startsWith("/publicacion")) return "publicacion";
  if (pathname.startsWith("/cobros")) return "cobros";
  if (pathname.startsWith("/campanas")) return "campanas";
  if (pathname.startsWith("/interno")) return "interno";
  if (pathname.startsWith("/redes")) return "redes";
  if (pathname.startsWith("/comentarios")) return "comentarios";
  if (pathname.startsWith("/promociones")) return "promociones";
  if (pathname.startsWith("/perfil")) return "perfil";
  if (pathname.startsWith("/sofia")) return "sofia";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/llamadas")) return "llamadas";
  if (pathname.startsWith("/agentes")) return "agentes";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}

// Primer modulo que ve un rol (a donde mandarlo si entra a uno que no puede ver).
export function primerModulo(def: { ve: ModuleId[] }): ModuleId {
  return def.ve[0] ?? "bandeja";
}


/**
 * ¿Puede este rol entrar a esta ruta?
 *
 * Las rutas que no corresponden a ningun modulo no se restringen: son cosas
 * como el login o los assets, y cerrarlas por rol dejaria a todos afuera.
 */
export function puedeVerRuta(rol: RoleId, pathname: string): boolean {
  const modulo = moduloDeRuta(pathname);
  if (!modulo) return true;
  return (VE[rol] ?? []).includes(modulo);
}
