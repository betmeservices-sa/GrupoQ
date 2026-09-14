import { cookies } from "next/headers";
import { doctorPorId, listarDoctores, listarSucursales, sucursalPorId } from "./almacen";
import type { Doctor, Sucursal, TipoUnidad } from "./tipos";

// Con cuál doctor y con cuál sucursal se está mirando el módulo.
//
// Es una cookie simple, sin firmar, y está bien que lo sea: la puerta de la app
// ya la cierra la sesión (proxy.ts), y del otro lado de esta cookie no hay
// privilegios, solo cuál de los dos escritorios de la misma clínica se está
// viendo. Firmarla daría una sensación de frontera que no existe.

export const COOKIE_DOCTOR = "consultorio_dr";
export const COOKIE_SUCURSAL = "consultorio_suc";

/** Una cookie por departamento: el laboratorio tiene dos sedes y se cambia
    entre ellas sin que eso mueva la unidad de imagenología. */
export const cookieDeUnidad = (tipo: TipoUnidad) => `consultorio_uni_${tipo}`;

export async function doctorActual(): Promise<Doctor> {
  const id = (await cookies()).get(COOKIE_DOCTOR)?.value;
  return (id ? doctorPorId(id) : null) ?? listarDoctores()[0];
}

export async function sucursalActual(): Promise<Sucursal> {
  return unidadActual("laboratorio");
}

/**
 * La unidad de un departamento: con cuál sede se está mirando su mostrador.
 *
 * Si la cookie apunta a una unidad de OTRO departamento se ignora: sería como
 * abrir el mostrador del laboratorio y encontrar la fila de imagenología.
 */
export async function unidadActual(tipo: TipoUnidad): Promise<Sucursal> {
  const galleta = await cookies();
  const id = galleta.get(cookieDeUnidad(tipo))?.value ?? galleta.get(COOKIE_SUCURSAL)?.value;
  const elegida = id ? sucursalPorId(id) : null;
  return elegida?.tipo === tipo ? elegida : listarSucursales(tipo)[0];
}
