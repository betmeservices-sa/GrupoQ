import { cookies } from "next/headers";
import { doctorPorId, listarDoctores, listarSucursales, sucursalPorId } from "./almacen";
import type { Doctor, Sucursal } from "./tipos";

// Con cuál doctor y con cuál sucursal se está mirando el módulo.
//
// Es una cookie simple, sin firmar, y está bien que lo sea: la puerta de la app
// ya la cierra la sesión (proxy.ts), y del otro lado de esta cookie no hay
// privilegios, solo cuál de los dos escritorios de la misma clínica se está
// viendo. Firmarla daría una sensación de frontera que no existe.

export const COOKIE_DOCTOR = "consultorio_dr";
export const COOKIE_SUCURSAL = "consultorio_suc";

export async function doctorActual(): Promise<Doctor> {
  const id = (await cookies()).get(COOKIE_DOCTOR)?.value;
  return (id ? doctorPorId(id) : null) ?? listarDoctores()[0];
}

export async function sucursalActual(): Promise<Sucursal> {
  const id = (await cookies()).get(COOKIE_SUCURSAL)?.value;
  return (id ? sucursalPorId(id) : null) ?? listarSucursales()[0];
}
