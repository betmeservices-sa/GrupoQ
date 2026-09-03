// Quién vende y quién manda, sacado del equipo que ya tiene cargado el cliente.
//
// No hay una lista aparte de vendedores: se derivan del staff del tenant, por
// departamento. Así, cuando el cliente agrega gente a su equipo, el reparto de
// casos la toma sola, sin tocar código.

import { TENANTS } from "./tenants";
import type { TenantId } from "./tenants/types";
import type { Vendedor } from "./ventas-pipeline";

/** Departamentos cuyo personal atiende prospectos. */
const DE_VENTAS = ["ventas", "usados", "crediq"];

export function vendedoresDe(tenant: string): Vendedor[] {
  const t = TENANTS[tenant as TenantId];
  if (!t) return [];
  return t.seed.staff
    .filter((s) => DE_VENTAS.includes(s.departamento) && s.rol !== "jefe")
    .map((s) => ({ id: s.id, nombre: s.nombre, iniciales: s.iniciales }));
}

/**
 * El gerente de ventas: la jefatura del área. Es a quien le llegan las alertas
 * cuando un caso se queda sin tomar.
 */
export function gerenteDe(tenant: string): Vendedor | null {
  const t = TENANTS[tenant as TenantId];
  if (!t) return null;
  const staff = t.seed.staff;
  const jefe =
    staff.find((s) => s.rol === "jefe" && DE_VENTAS.includes(s.departamento)) ??
    staff.find((s) => s.rol === "jefe") ??
    null;
  return jefe ? { id: jefe.id, nombre: jefe.nombre, iniciales: jefe.iniciales } : null;
}

export function nombreDeVendedor(tenant: string, id: string | null | undefined): string {
  if (!id) return "sin asignar";
  if (id === "sistema") return "el sistema";
  if (id === "sofia") return "Sofía";
  const t = TENANTS[tenant as TenantId];
  return t?.seed.staff.find((s) => s.id === id)?.nombre ?? id;
}
