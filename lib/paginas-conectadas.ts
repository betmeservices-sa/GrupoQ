"use client";

// Las páginas conectadas del cliente, para el selector de la bandeja y el de
// comentarios. Se piden una vez y se comparten.

import { useEffect, useState } from "react";
import type { PaginaOpcion } from "@/components/inbox/PaginaToggle";

let cache: PaginaOpcion[] | null = null;
let pedido: Promise<PaginaOpcion[]> | null = null;

async function pedir(): Promise<PaginaOpcion[]> {
  try {
    const r = await fetch("/api/meta/connections", { cache: "no-store" });
    const d = (await r.json()) as { ok?: boolean; conexiones?: { pageId: string; nombre: string }[] };
    cache = (d.conexiones ?? []).map((c) => ({ id: c.pageId, nombre: c.nombre }));
  } catch {
    cache = cache ?? [];
  }
  return cache;
}

export function usePaginasConectadas(): PaginaOpcion[] {
  const [paginas, setPaginas] = useState<PaginaOpcion[]>(cache ?? []);
  useEffect(() => {
    let vivo = true;
    (pedido ??= pedir()).then((p) => {
      if (vivo) setPaginas(p);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return paginas;
}
