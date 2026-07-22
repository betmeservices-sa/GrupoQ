"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { RoleId } from "./data/types";
import { activeTenant } from "./tenants/active";

export type ModuleId = "bandeja" | "contactos" | "interno" | "redes" | "dashboard" | "llamadas" | "settings";

export interface RoleDef {
  id: RoleId;
  nombre: string;
  ve: ModuleId[];
}

// Qué módulos ve cada rol (igual para todos los tenants):
//   Recepción       -> Bandeja + Chat interno
//   Marketing       -> Bandeja + Redes sociales
//   Dirección       -> todo
//   Gerente de Mkt. -> todo
// Médico/Asesor y Jefe mantienen su acceso operativo (bandeja/interno/dashboard).
const TODO: ModuleId[] = ["bandeja", "contactos", "interno", "redes", "dashboard", "llamadas", "settings"];
const VE: Record<RoleId, ModuleId[]> = {
  recepcion: ["bandeja", "contactos", "interno"],
  marketing: ["bandeja", "contactos", "redes"],
  gerente_marketing: TODO,
  medico: ["bandeja", "contactos", "interno"],
  jefe: ["bandeja", "contactos", "interno", "dashboard"],
  admin: TODO,
};

// Las etiquetas de los roles vienen del tenant activo (ej. "Médico" en el
// hospital, "Asesor" en Grupo Q). Los ids internos no cambian.
const rolesLabels = activeTenant().roles;

export const ROLES: Record<RoleId, RoleDef> = {
  recepcion: { id: "recepcion", nombre: rolesLabels.recepcion, ve: VE.recepcion },
  marketing: { id: "marketing", nombre: rolesLabels.marketing, ve: VE.marketing },
  gerente_marketing: { id: "gerente_marketing", nombre: rolesLabels.gerente_marketing, ve: VE.gerente_marketing },
  medico: { id: "medico", nombre: rolesLabels.medico, ve: VE.medico },
  jefe: { id: "jefe", nombre: rolesLabels.jefe, ve: VE.jefe },
  admin: { id: "admin", nombre: rolesLabels.admin, ve: VE.admin },
};

// Ruta de cada modulo (para navegar / redirigir).
export const MODULO_RUTA: Record<ModuleId, string> = {
  bandeja: "/",
  contactos: "/contactos",
  interno: "/interno",
  redes: "/redes",
  dashboard: "/dashboard",
  llamadas: "/llamadas",
  settings: "/settings",
};

// Que modulo corresponde a una ruta. null = ruta sin modulo (no se restringe).
export function moduloDeRuta(pathname: string): ModuleId | null {
  if (pathname === "/") return "bandeja";
  if (pathname.startsWith("/contactos")) return "contactos";
  if (pathname.startsWith("/interno")) return "interno";
  if (pathname.startsWith("/redes")) return "redes";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/llamadas")) return "llamadas";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}

// Primer modulo que ve un rol (a donde mandarlo si entra a uno que no puede ver).
export function primerModulo(def: RoleDef): ModuleId {
  return def.ve[0] ?? "bandeja";
}

const STORAGE_KEY = "ccg.rol";
const DEFAULT_ROLE: RoleId = "gerente_marketing"; // el demo abre como Gerente de Marketing (acceso total)

// Store compartido del rol: un solo estado para TODOS los que usan useRole
// (RoleSwitcher, Sidebar, AppShell). Así "Ver como" filtra el menú y las rutas
// en vivo, sin recargar. (Antes cada componente tenía su propio useState y no se
// sincronizaban.)
let rolActual: RoleId = DEFAULT_ROLE;
const oyentes = new Set<() => void>();
function emitir() {
  for (const l of oyentes) l();
}
function subscribe(l: () => void) {
  oyentes.add(l);
  return () => oyentes.delete(l);
}

export function setRol(next: RoleId) {
  if (!(next in ROLES)) return; // ignora roles inválidos (nunca dejamos el store en un estado que rompa)
  rolActual = next;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, next);
  emitir();
}

export function useRole() {
  const rol = useSyncExternalStore(
    subscribe,
    () => rolActual,
    () => DEFAULT_ROLE, // snapshot en el servidor (evita mismatch de hidratación)
  );

  // Hidrata desde localStorage una sola vez (post-montaje).
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as RoleId | null;
    if (saved && saved in ROLES && saved !== rolActual) setRol(saved);
  }, []);

  // Fallback defensivo: si el rol guardado no existe (p. ej. un rol viejo que se
  // quitó), usamos el rol por defecto en vez de romper la app con def undefined.
  return { rol, setRol, def: ROLES[rol] ?? ROLES[DEFAULT_ROLE] };
}
