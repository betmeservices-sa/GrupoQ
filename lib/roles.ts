"use client";

import { useEffect, useState } from "react";
import type { RoleId } from "./data/types";

export type ModuleId = "bandeja" | "interno" | "redes" | "dashboard" | "settings";

export interface RoleDef {
  id: RoleId;
  nombre: string;
  ve: ModuleId[];
}

// Cada rol ve solo sus modulos. Atencion al Cliente y Asesor atienden clientes
// (bandeja), pero NO ven redes ni metricas. Marketing ve redes y dashboard, pero
// NO la bandeja de clientes (privacidad). Direccion ve todo.
export const ROLES: Record<RoleId, RoleDef> = {
  recepcion: { id: "recepcion", nombre: "Atención al Cliente", ve: ["bandeja", "interno"] },
  marketing: { id: "marketing", nombre: "Marketing", ve: ["redes", "dashboard", "interno", "settings"] },
  medico: { id: "medico", nombre: "Asesor", ve: ["bandeja", "interno"] },
  jefe: { id: "jefe", nombre: "Jefe de área", ve: ["bandeja", "interno", "dashboard"] },
  admin: { id: "admin", nombre: "Dirección (todo)", ve: ["bandeja", "interno", "redes", "dashboard", "settings"] },
};

// Ruta de cada modulo (para navegar / redirigir).
export const MODULO_RUTA: Record<ModuleId, string> = {
  bandeja: "/",
  interno: "/interno",
  redes: "/redes",
  dashboard: "/dashboard",
  settings: "/settings",
};

// Que modulo corresponde a una ruta. null = ruta sin modulo (no se restringe).
export function moduloDeRuta(pathname: string): ModuleId | null {
  if (pathname === "/") return "bandeja";
  if (pathname.startsWith("/interno")) return "interno";
  if (pathname.startsWith("/redes")) return "redes";
  if (pathname.startsWith("/dashboard")) return "dashboard";
  if (pathname.startsWith("/settings")) return "settings";
  return null;
}

// Primer modulo que ve un rol (a donde mandarlo si entra a uno que no puede ver).
export function primerModulo(def: RoleDef): ModuleId {
  return def.ve[0] ?? "bandeja";
}

const STORAGE_KEY = "ccg.rol";
const DEFAULT_ROLE: RoleId = "admin"; // el demo abre mostrando todo

export function useRole() {
  const [rol, setRolState] = useState<RoleId>(DEFAULT_ROLE);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as RoleId | null;
    if (saved && saved in ROLES) {
      setRolState(saved);
    }
  }, []);

  function setRol(next: RoleId) {
    setRolState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return { rol, setRol, def: ROLES[rol] };
}
