"use client";

// Quién soy en este cliente: la ficha del equipo (s2 = Verónica) con la que se
// firma lo que mando y se decide qué chats son "míos".
//
// Sale de la sesión, no del navegador: una cuenta de persona trae su ficha en
// USUARIOS. Un login de demo no es nadie y usa la ficha genérica del tenant
// (ME), que es lo que había antes.

import { useEffect, useSyncExternalStore } from "react";
import { ME } from "@/lib/data/seed";

let fichaActual: string | null = null;
let nombreActual: string | null = null;
let pedida = false;
const oyentes = new Set<() => void>();

function emitir() {
  for (const o of oyentes) o();
}

async function cargar() {
  if (pedida) return;
  pedida = true;
  try {
    const r = await fetch("/api/auth/sesion");
    if (!r.ok) return;
    const d = (await r.json()) as { staffId?: string | null; nombre?: string | null };
    let cambio = false;
    if (d.staffId && d.staffId !== fichaActual) {
      fichaActual = d.staffId;
      cambio = true;
    }
    if (d.nombre && d.nombre !== nombreActual) {
      nombreActual = d.nombre;
      cambio = true;
    }
    if (cambio) emitir();
  } catch {
    // Sin respuesta se queda con la ficha genérica.
  }
}

function subscribe(cb: () => void) {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

/** Mi ficha (s2, s3...) o la genérica del tenant si no tengo. */
export function useYo(): string {
  const ficha = useSyncExternalStore(
    subscribe,
    () => fichaActual,
    () => null,
  );
  useEffect(() => {
    void cargar();
  }, []);
  return ficha ?? ME;
}

/**
 * Cómo se llama quien entró (de la sesión), o null si todavía no se sabe. El
 * pie de la barra lo usa para no mostrar la ficha genérica del tenant.
 */
export function useYoNombre(): string | null {
  const nombre = useSyncExternalStore(
    subscribe,
    () => nombreActual,
    () => null,
  );
  useEffect(() => {
    void cargar();
  }, []);
  return nombre;
}
