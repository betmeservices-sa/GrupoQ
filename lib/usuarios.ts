// Cuentas de persona, con nombre y rol propios.
//
// Distinto de DEMO_LOGINS, que son contraseñas de DEMOSTRACIÓN: ahí el usuario
// da igual y la contraseña decide qué panel se abre. Eso está bien para enseñar
// un demo y está mal para un cliente en producción, donde cada persona tiene
// que entrar con lo suyo y ver solo lo que le toca.
//
// EN PRODUCCIÓN LAS CUENTAS VAN EN LA VARIABLE `USUARIOS`, nunca acá: este repo
// es público. Formato, separando cuentas con coma:
//
//   USUARIOS="correo|contraseña|tenant|rol|Nombre Visible,otro|..."
//
// Si la variable existe, manda ella y esta lista deja de funcionar por completo.

import { isTenantId } from "./tenants";
import type { TenantId } from "./tenants/types";
import type { RoleId } from "./data/types";

export interface CuentaUsuario {
  usuario: string;
  password: string;
  tenant: TenantId;
  rol: RoleId;
  nombre: string;
}

const ROLES_VALIDOS = new Set<RoleId>([
  "recepcion",
  "atencion",
  "marketing",
  "gerente_marketing",
  "medico",
  "jefe",
  "admin",
]);

function esRol(v: string): v is RoleId {
  return ROLES_VALIDOS.has(v as RoleId);
}

/**
 * Las cuentas escritas en el código.
 *
 * Vacía a propósito. Cualquier cuenta real que se escriba acá queda publicada
 * en GitHub junto con su contraseña, y la de Verónica abre una bandeja con
 * conversaciones de huéspedes reales.
 */
const EN_CODIGO: CuentaUsuario[] = [];

function desdeEnv(): CuentaUsuario[] | null {
  const raw = process.env.USUARIOS;
  if (!raw) return null;
  const cuentas: CuentaUsuario[] = [];
  for (const linea of raw.split(",")) {
    const [usuario, password, tenant, rol, ...resto] = linea.split("|").map((x) => x.trim());
    if (!usuario || !password || !tenant || !rol) continue;
    if (!isTenantId(tenant) || !esRol(rol)) continue;
    cuentas.push({
      usuario: usuario.toLowerCase(),
      password,
      tenant,
      rol,
      nombre: resto.join("|").trim() || usuario,
    });
  }
  return cuentas.length > 0 ? cuentas : null;
}

export function cuentas(): CuentaUsuario[] {
  return desdeEnv() ?? EN_CODIGO;
}

// Comparación en tiempo constante para no filtrar la clave carácter a carácter.
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

/** La cuenta que corresponde a un usuario y contraseña, o null. */
export function buscarCuenta(usuario: string, password: string): CuentaUsuario | null {
  const u = usuario.trim().toLowerCase();
  if (!u || !password) return null;
  // Se recorren TODAS aunque la primera coincida: cortar antes deja que el
  // tiempo de respuesta delate si el usuario existe.
  let encontrada: CuentaUsuario | null = null;
  for (const c of cuentas()) {
    if (c.usuario === u && iguales(password, c.password)) encontrada = c;
  }
  return encontrada;
}

/** La cuenta de un correo, sin comprobar la clave. Para leer su clave inicial. */
export function cuentaDeUsuario(usuario: string): CuentaUsuario | null {
  const u = usuario.trim().toLowerCase();
  return cuentas().find((c) => c.usuario === u) ?? null;
}
