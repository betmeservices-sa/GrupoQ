// Marcar actividad desde una ruta que solo tiene la petición a mano (las
// bandejas, que el navegador sondea cada pocos segundos).

import { leerSesion, sesionDeCookieHeader } from "./session";
import { cuentaDeUsuario } from "./usuarios";
import { tocarActividad } from "./accesos";

export async function tocarSesion(req: Request): Promise<void> {
  try {
    const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
    if (!sesion?.usuario) return;
    const cuenta = cuentaDeUsuario(sesion.usuario);
    await tocarActividad({ usuario: sesion.usuario, tenant: sesion.tenant, nombre: cuenta?.nombre, rol: sesion.rol, host: req.headers.get("host") });
  } catch {
    // La actividad es un detalle: nunca frena la bandeja.
  }
}
