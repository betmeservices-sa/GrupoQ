"use client";

import { useEffect, useState } from "react";

// Login DEMO: credenciales fijas y sesión en localStorage. Sin backend ni BD.
export const DEMO_EMAIL = "sandra@gmail.com";
export const DEMO_PASSWORD = "123456";

const STORAGE_KEY = "ccg.sesion";

export function useAuth() {
  // null = todavía no se leyó localStorage (evita parpadeo y errores de hidratación).
  const [sesion, setSesion] = useState<boolean | null>(null);

  useEffect(() => {
    setSesion(window.localStorage.getItem(STORAGE_KEY) === DEMO_EMAIL);
  }, []);

  function login(email: string, password: string): boolean {
    const ok =
      email.trim().toLowerCase() === DEMO_EMAIL && password === DEMO_PASSWORD;
    if (ok) {
      window.localStorage.setItem(STORAGE_KEY, DEMO_EMAIL);
      setSesion(true);
    }
    return ok;
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSesion(false);
  }

  return { sesion, login, logout };
}
