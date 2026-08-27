// Quién es la persona detrás de una sesión, para firmar lo que manda.
//
// Una cuenta de persona (Verónica, Olga) tiene su ficha en el equipo del
// cliente (s2, s3): se firma con la ficha y el panel pinta su nombre. Una
// cuenta sin ficha (la de la agencia) se firma con su nombre. Un login de demo
// no es nadie: se firma con la ficha genérica del tenant ("Gerente de
// Marketing"), que es lo que ya mostraba el panel.

import { leerSesion, sesionDeCookieHeader } from "./session";
import { cuentaDeUsuario } from "./usuarios";
import { TENANTS } from "./tenants";
import type { TenantId } from "./tenants/types";
import type { QuienResponde } from "./meta-enviar";

export async function quienResponde(req: Request, tenant: TenantId): Promise<QuienResponde> {
  const sesion = await leerSesion(sesionDeCookieHeader(req.headers.get("cookie")));
  const cuenta = sesion?.usuario ? cuentaDeUsuario(sesion.usuario) : null;
  if (cuenta) {
    // La ficha vale solo dentro del cliente al que pertenece la cuenta: la de
    // la agencia, entrando a Yali, no tiene ficha ahí y va con su nombre.
    const ficha = cuenta.tenant === tenant && !cuenta.todos ? cuenta.staffId : undefined;
    return { staffId: ficha, nombre: cuenta.nombre };
  }
  const seed = TENANTS[tenant]?.seed;
  const me = seed?.staff.find((s) => s.id === seed.ME);
  return { staffId: seed?.ME, nombre: me?.nombre ?? "Equipo" };
}
