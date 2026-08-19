// El perfil del agente tal como lo ve el dueño del hotel.
//
// El guion completo de Sofía son varias páginas: reglas de estilo, barandas de
// seguridad, manejo de fotos, herramientas, formato de salida. Nada de eso le
// sirve al dueño y mostrárselo solo logra que sienta que puede tocar algo que
// no debe. Aquí viven las CUATRO ideas que sí le importan, en una frase cada
// una, y son las únicas que se muestran y se pueden pedir cambiar.
//
// El texto de abajo es un resumen escrito a mano, no un recorte automático del
// guion: si el guion cambia, este resumen se revisa a mano. Un extracto
// automático terminaría filtrando justo lo que se quiso esconder.

import type { TenantId } from "./tenants/types";

export type CampoPerfilId = "personalidad" | "objetivo" | "saludo" | "limites";

export interface CampoPerfil {
  id: CampoPerfilId;
  titulo: string;
  /** Una línea que explica para qué sirve el campo, en idioma de hotelero. */
  ayuda: string;
  texto: string;
  icono: string; // nombre del ícono lucide, lo mapea la pantalla
}

const PERFIL_YALI: CampoPerfil[] = [
  {
    id: "personalidad",
    titulo: "Personalidad",
    ayuda: "Cómo suena cuando le escriben",
    texto:
      "Cálida, cercana y resolutiva. Habla de usted, en mensajes cortos de WhatsApp, una idea a la vez. Usa el nombre del huésped de vez en cuando y algún emoji, sin exagerar.",
    icono: "Sparkles",
  },
  {
    id: "objetivo",
    titulo: "Objetivo",
    ayuda: "Para qué está la conversación",
    texto:
      "Dejar la habitación reservada. Informa solo como paso hacia la reserva y nunca cierra un mensaje sin un siguiente paso claro. Si en tres o cuatro idas y vueltas no avanza, ofrece pasar el chat a una persona.",
    icono: "Target",
  },
  {
    id: "saludo",
    titulo: "Saludo",
    ayuda: "El primer mensaje que recibe el huésped",
    texto:
      "Se presenta como Sofía de Yali Hospitality y pregunta a cuál de los tres hoteles escribe, con las opciones A, B y C para que responda con una letra.",
    icono: "MessageSquare",
  },
  {
    id: "limites",
    titulo: "Lo que no promete",
    ayuda: "Dónde se detiene y llama al equipo",
    texto:
      "No confirma pagos ni anticipos, no inventa tarifas ni promociones, y no promete traslados, mascotas ni cunas sin confirmación. Cuando algo se sale de reservas y estadías, pasa el chat a una persona.",
    icono: "ShieldCheck",
  },
];

/** Perfil visible del agente del cliente. Vacío = ese cliente no tiene pantalla. */
export function perfilDeTenant(tenant: TenantId): CampoPerfil[] {
  return tenant === "yaly" ? PERFIL_YALI.map((c) => ({ ...c })) : [];
}

export function campoPerfil(tenant: TenantId, id: string): CampoPerfil | null {
  return perfilDeTenant(tenant).find((c) => c.id === id) ?? null;
}

/**
 * Número con el que el hotel puede preguntar por su cambio. Se genera acá y no
 * en la pantalla para que sea el servidor quien lo emita, igual que el número
 * de una reserva.
 */
export function numeroDeGestion(): string {
  return `SOL-${Math.floor(100000 + Math.random() * 900000)}`;
}
