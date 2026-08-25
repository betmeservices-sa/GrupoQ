// La contraseña que cada persona se puso.
//
// La comparación pasa dentro de Postgres, en funciones que corren con permisos
// del dueño (ver supabase/migrations/20260825120000_usuarios_clave.sql). Acá
// nunca se ve una huella: se pregunta "¿esta clave es correcta?" y se recibe sí
// o no.
//
// Sin Supabase configurado todo esto devuelve null y el login cae a la clave
// inicial de la variable USUARIOS, que es como funcionaba antes.

import { getSupabase } from "./supabase";

/**
 * ¿La clave es correcta?
 *
 * null = esa persona nunca se la cambió, así que hay que comparar contra la
 * inicial. Distinguirlo de `false` importa: `false` es clave equivocada.
 */
export async function claveCorrecta(usuario: string, clave: string): Promise<boolean | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("verificar_clave", {
    p_usuario: usuario,
    p_clave: clave,
  });
  if (error) {
    console.error("[usuarios-clave] verificar:", error.message);
    return null;
  }
  return data === null || data === undefined ? null : Boolean(data);
}

/** ¿Ya se cambió la clave alguna vez? Lo usa el panel para ofrecerlo. */
export async function yaCambioClave(usuario: string): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { data, error } = await sb.rpc("clave_cambiada", { p_usuario: usuario });
  if (error) {
    console.error("[usuarios-clave] clave_cambiada:", error.message);
    return false;
  }
  return Boolean(data);
}

export interface ResultadoCambio {
  ok: boolean;
  error?: string;
}

/**
 * Cambia la clave. `inicial` es la que le dimos nosotros, y solo sirve la
 * primera vez: después manda la que ella misma puso.
 */
export async function cambiarClave(
  usuario: string,
  actual: string,
  nueva: string,
  inicial: string | null,
): Promise<ResultadoCambio> {
  if (nueva.length < 8) {
    return { ok: false, error: "La contraseña nueva necesita al menos 8 caracteres." };
  }
  if (nueva === actual) {
    return { ok: false, error: "La contraseña nueva tiene que ser distinta de la actual." };
  }

  const sb = getSupabase();
  if (!sb) {
    return { ok: false, error: "No se puede cambiar la contraseña ahora mismo." };
  }

  const { data, error } = await sb.rpc("cambiar_clave", {
    p_usuario: usuario,
    p_actual: actual,
    p_nueva: nueva,
    p_inicial: inicial,
  });
  if (error) {
    console.error("[usuarios-clave] cambiar:", error.message);
    return { ok: false, error: "No se pudo guardar la contraseña." };
  }
  if (!data) {
    // Puede ser la actual equivocada o la nueva muy corta. No se distingue a
    // propósito: decir cuál de las dos falló ayuda a quien está probando
    // claves ajenas.
    return { ok: false, error: "La contraseña actual no es correcta." };
  }
  return { ok: true };
}
