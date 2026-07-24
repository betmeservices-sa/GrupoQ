// Almacén de secretos 2FA POR USUARIO. SOLO servidor.
//
// DEMO: guarda en memoria del proceso. Alcanza para ver el flujo en local (un
// solo server de dev), pero NO persiste entre reinicios ni entre instancias
// serverless. Para producción hay que respaldarlo en una tabla (ver SEAM abajo),
// si no cada usuario tendría que re-enrolar en cada cold start.

import { generarSecreto } from "./totp";

export interface Registro2FA {
  secret: string; // secreto Base32 del usuario
  enrolado: boolean; // ya confirmó un código al menos una vez
}

const memoria = new Map<string, Registro2FA>();

function clave(usuario: string): string {
  return usuario.trim().toLowerCase();
}

/**
 * Devuelve el registro 2FA del usuario. Si no existe, lo crea con un secreto
 * nuevo y enrolado=false (así el primer login genera el secreto para el QR).
 */
export function obtenerOCrear2FA(usuario: string): Registro2FA {
  const k = clave(usuario);
  let reg = memoria.get(k);
  if (!reg) {
    reg = { secret: generarSecreto(), enrolado: false };
    memoria.set(k, reg);
  }
  return reg;
}

/** Marca al usuario como enrolado (tras confirmar su primer código). */
export function marcarEnrolado2FA(usuario: string): void {
  const reg = memoria.get(clave(usuario));
  if (reg) reg.enrolado = true;
}

// SEAM PRODUCCIÓN: para persistir de verdad, reemplazar el Map por una tabla,
// p. ej. Supabase `dashboard_2fa(usuario text primary key, secret text not null,
// enrolado boolean not null default false)`, y volver estas funciones async:
//   obtenerOCrear2FA: SELECT; si no hay fila, INSERT con generarSecreto().
//   marcarEnrolado2FA: UPDATE ... SET enrolado = true WHERE usuario = ...
// El resto del flujo (route + UI) no cambia.
