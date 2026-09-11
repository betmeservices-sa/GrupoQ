import { cookies } from "next/headers";
import { isTenantId } from "@/lib/tenants";
import { SESSION_COOKIE } from "@/lib/session";

/**
 * ¿La sesión que está mirando es la de la clínica?
 *
 * Las páginas de este módulo leen los datos en el SERVIDOR, así que no alcanza
 * con que sus /api comprueben el tenant: sin esto, la cuenta de otro cliente
 * podía escribir /consultorio en la barra y ver los pacientes ya pintados en el
 * HTML. El menú que no muestra el módulo es comodidad; esto es la puerta.
 *
 * Se lee el tenant de la cookie de sesión firmada, igual que en las rutas de
 * API: el middleware ya validó la firma antes de que esto corra.
 */
export async function esDeLaClinica(): Promise<boolean> {
  const valor = (await cookies()).get(SESSION_COOKIE)?.value;
  const tenant = valor?.split(".")[0];
  return isTenantId(tenant) && tenant === "consultorio";
}
