// Validación de credenciales. SOLO servidor (lo importa /api/auth/login).
//
// El repo es público, así que las contraseñas que viven en lib/tenants
// (DEMO_LOGINS) son visibles para cualquiera en GitHub. Como los dashboards
// muestran datos de clientes reales, eso no puede ser la única puerta.
//
// Si existe la variable LOGIN_PASSWORDS, manda ella y las del código dejan de
// funcionar. Formato: "tenant:clave,tenant:clave"
//   LOGIN_PASSWORDS="hospital:xK9...,grupoq:mP2...,excel:vB7...,miagentia:qL4..."
//
// Si NO existe, se cae a DEMO_LOGINS para no dejar el demo inservible de golpe.
// En producción eso se avisa por consola: hay que configurarla.

import { DEMO_LOGINS, isTenantId } from "./tenants";
import type { TenantId } from "./tenants/types";
import type { RoleId } from "./data/types";
import { buscarCuenta, cuentaDeUsuario } from "./usuarios";
import { claveCorrecta } from "./usuarios-clave";

let avisado = false;

function desdeEnv(): Map<string, TenantId> | null {
  const raw = process.env.LOGIN_PASSWORDS;
  if (!raw) return null;
  const mapa = new Map<string, TenantId>();
  for (const par of raw.split(",")) {
    const i = par.indexOf(":");
    if (i <= 0) continue;
    const tenant = par.slice(0, i).trim();
    const clave = par.slice(i + 1).trim();
    if (isTenantId(tenant) && clave) mapa.set(clave, tenant);
  }
  return mapa.size > 0 ? mapa : null;
}

// Comparación en tiempo constante para no filtrar la clave carácter a carácter.
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let dif = 0;
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return dif === 0;
}

export interface Acceso {
  tenant: TenantId;
  /** El correo con el que entro. Vacio en los logins de demo. */
  usuario?: string;
  /** El rol con el que entra. Los logins de demo entran viendo todo. */
  rol: RoleId;
  nombre?: string;
  /** true = el rol viene de una cuenta de persona y NO se puede cambiar. */
  fijo: boolean;
  /** Cuenta de la agencia: puede cambiar de cliente. */
  todos?: boolean;
}

export async function validarCredenciales(usuario: string, password: string): Promise<Acceso | null> {
  const u = usuario.trim().toLowerCase();
  if (!u || !password) return null;

  // Primero las cuentas de persona: son las de clientes en produccion y traen
  // su propio rol, que despues nadie puede cambiar desde el navegador.
  //
  // La clave puede ser la que le dimos nosotros o la que ella misma se puso.
  // Manda la propia: en cuanto existe, la inicial deja de servir. Si no fuera
  // asi, la clave que mandamos por chat seguiria abriendo la cuenta para
  // siempre, y cambiarla no serviria de nada.
  const cuenta = cuentaDeUsuario(u);
  if (cuenta) {
    const propia = await claveCorrecta(u, password);
    const ok = propia === null ? Boolean(buscarCuenta(u, password)) : propia;
    if (ok) {
      return {
        tenant: cuenta.tenant,
        rol: cuenta.rol,
        nombre: cuenta.nombre,
        fijo: true,
        usuario: cuenta.usuario,
        todos: cuenta.todos === true,
      };
    }
    return null;
  }

  const env = desdeEnv();
  if (env) {
    for (const [clave, tenant] of env) {
      if (iguales(password, clave)) return { tenant, rol: "gerente_marketing", fijo: false };
    }
    return null;
  }

  if (!avisado && process.env.NODE_ENV === "production") {
    avisado = true;
    console.error(
      "[auth] LOGIN_PASSWORDS no está configurada: se están usando las contraseñas del repo, que es público.",
    );
  }

  const match = DEMO_LOGINS.find(
    (l) => l.usuario.toLowerCase() === u && iguales(password, l.password),
  );
  // Los logins de demo siguen entrando con acceso total y con el selector de
  // "ver como" disponible: son para enseñar el producto, no para trabajar.
  return match ? { tenant: match.tenant, rol: "gerente_marketing", fijo: false } : null;
}
