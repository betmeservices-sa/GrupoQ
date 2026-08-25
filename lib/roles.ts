"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { RoleId } from "./data/types";
import { activeTenant } from "./tenants/active";
import { MODULO_RUTA, VE, moduloDeRuta, primerModulo, puedeVerRuta, type ModuleId, type RoleDef } from "./modulos";

export { MODULO_RUTA, moduloDeRuta, primerModulo, puedeVerRuta };
export type { ModuleId, RoleDef };

// Las etiquetas de los roles vienen del tenant activo (ej. "Médico" en el
// hospital, "Asesor" en Grupo Q). Los ids internos no cambian.
const rolesLabels = activeTenant().roles;

export const ROLES: Record<RoleId, RoleDef> = {
  recepcion: { id: "recepcion", nombre: rolesLabels.recepcion, ve: VE.recepcion },
  atencion: { id: "atencion", nombre: rolesLabels.atencion, ve: VE.atencion },
  marketing: { id: "marketing", nombre: rolesLabels.marketing, ve: VE.marketing },
  gerente_marketing: { id: "gerente_marketing", nombre: rolesLabels.gerente_marketing, ve: VE.gerente_marketing },
  medico: { id: "medico", nombre: rolesLabels.medico, ve: VE.medico },
  jefe: { id: "jefe", nombre: rolesLabels.jefe, ve: VE.jefe },
  admin: { id: "admin", nombre: rolesLabels.admin, ve: VE.admin },
};

const STORAGE_KEY = "ccg.rol";
const DEFAULT_ROLE: RoleId = "gerente_marketing"; // el demo abre como Gerente de Marketing (acceso total)

// Store compartido del rol: un solo estado para TODOS los que usan useRole
// (RoleSwitcher, Sidebar, AppShell). Así "Ver como" filtra el menú y las rutas
// en vivo, sin recargar. (Antes cada componente tenía su propio useState y no se
// sincronizaban.)
let rolActual: RoleId = DEFAULT_ROLE;
// true = el rol vino de una cuenta de persona. Con esto NO se puede cambiar de
// rol desde el navegador: el "ver como" es para enseñar el demo, no para que
// alguien se ascienda a si mismo.
let rolFijo = false;
const oyentes = new Set<() => void>();
function emitir() {
  for (const l of oyentes) l();
}
function subscribe(l: () => void) {
  oyentes.add(l);
  return () => oyentes.delete(l);
}

export function setRol(next: RoleId) {
  if (rolFijo) return; // cuenta de persona: su rol no se cambia desde acá
  if (!(next in ROLES)) return; // ignora roles inválidos (nunca dejamos el store en un estado que rompa)
  rolActual = next;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  emitir();
}

/** Fija el rol que dijo el servidor. Lo llama el arranque, una sola vez. */
function fijarDesdeSesion(rol: RoleId, fijo: boolean) {
  if (!(rol in ROLES)) return;
  rolFijo = fijo;
  if (rolActual !== rol) {
    rolActual = rol;
    emitir();
  }
}

export function rolEsFijo(): boolean {
  return rolFijo;
}

// Se pregunta UNA vez por carga de página, no una por componente.
let sesionPedida = false;
async function cargarSesion() {
  if (sesionPedida) return;
  sesionPedida = true;
  try {
    const r = await fetch("/api/auth/sesion");
    if (!r.ok) return;
    const d = (await r.json()) as { rol?: RoleId; fijo?: boolean };
    if (d.rol) fijarDesdeSesion(d.rol, Boolean(d.fijo));
  } catch {
    // Sin respuesta se queda con lo que haya: el menú puede quedar optimista,
    // pero entrar a un módulo prohibido igual lo frena el servidor.
  }
}

export function useRole() {
  const rol = useSyncExternalStore(
    subscribe,
    () => rolActual,
    () => DEFAULT_ROLE, // snapshot en el servidor (evita mismatch de hidratación)
  );

  // Primero lo guardado (para que el menú no parpadee) y después lo que diga el
  // servidor, que es lo que manda: si la sesión trae un rol fijo, pisa a
  // cualquier cosa que hubiera quedado en este navegador.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as RoleId | null;
    if (saved && saved in ROLES && saved !== rolActual) setRol(saved);
    void cargarSesion();
  }, []);

  // Fallback defensivo: si el rol guardado no existe (p. ej. un rol viejo que se
  // quitó), usamos el rol por defecto en vez de romper la app con def undefined.
  return { rol, setRol, def: ROLES[rol] ?? ROLES[DEFAULT_ROLE] };
}
