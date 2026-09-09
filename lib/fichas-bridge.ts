"use client";

// Trae las fichas de Contactos para que la bandeja pueda ponerles nombre.
//
// Se sondea despacio a propósito. Los mensajes se sondean cada 4 segundos
// porque llegan solos; las fichas las edita una persona a mano, y con dos
// minutos alcanza. Además se vuelve a pedir cuando la pestaña vuelve al frente,
// que es cuando alguien acaba de editar una ficha en otra pantalla y regresa.

import { useEffect, useState } from "react";
import { indexarFichas, type FichaContacto } from "./ficha-en-bandeja";

const CADA_MS = 120_000;

const VACIO = new Map<string, FichaContacto>();

export function useFichas(): Map<string, FichaContacto> {
  const [fichas, setFichas] = useState<Map<string, FichaContacto>>(VACIO);

  useEffect(() => {
    let vivo = true;
    const traer = async () => {
      try {
        const r = await fetch("/api/contactos", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { ok?: boolean; contactos?: FichaContacto[] };
        if (!vivo || !d.ok || !Array.isArray(d.contactos)) return;
        setFichas(indexarFichas(d.contactos));
      } catch {
        // Silencioso: sin fichas la bandeja sigue mostrando el número, que es
        // lo que mostraba antes. No es motivo para romper nada.
      }
    };
    void traer();
    const h = window.setInterval(traer, CADA_MS);
    const alVolver = () => {
      if (document.visibilityState === "visible") void traer();
    };
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      vivo = false;
      window.clearInterval(h);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  return fichas;
}
