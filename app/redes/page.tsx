"use client";

import { useEffect, useMemo, useState } from "react";
import { PenSquare, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { PostComposer } from "@/components/social/PostComposer";
import { ColumnaRed } from "@/components/social/ColumnaRed";
import { PreviewModal } from "@/components/social/PreviewModal";
import { imagenesDe, ordenarCuentas } from "@/lib/social";
import { activeTenant } from "@/lib/tenants/active";
import type { SocialPost, SocialStats as SocialStatsT } from "@/lib/data/types";

export default function RedesPage() {
  const { state, dispatch } = useStore();

  // Stats reales de las cuentas conectadas por OAuth (si el tenant conectó su
  // página). demo:true = sin conexión, se queda el seed del tenant.
  const [reales, setReales] = useState<SocialStatsT[] | null>(null);
  // Publicación abierta en vista previa: se ve cómo queda en cada red antes de
  // publicarla, que es donde se nota lo que recorta cada una.
  const [preview, setPreview] = useState<SocialPost | null>(null);
  const [componiendo, setComponiendo] = useState(false);

  useEffect(() => {
    const tenant = window.localStorage.getItem("ccg.tenant") || "x";
    const cacheKey = `ccg.meta.stats.${tenant}`;
    // Mostrar al instante las últimas stats reales guardadas (si la cuenta está
    // conectada), para no parpadear del placeholder a lo real en cada carga.
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) setReales(JSON.parse(cached));
    } catch {}
    fetch("/api/meta/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && !d.demo && d.stats?.length) {
          setReales(d.stats);
          try {
            window.localStorage.setItem(cacheKey, JSON.stringify(d.stats));
          } catch {}
        } else if (d.ok && d.demo) {
          // Cuenta no conectada: limpiar cache viejo y quedarse con el seed.
          try {
            window.localStorage.removeItem(cacheKey);
          } catch {}
          setReales(null);
        }
      })
      .catch(() => {});
  }, []);

  const cuentas = useMemo(() => ordenarCuentas(reales ?? state.socialStats), [reales, state.socialStats]);

  // Cada columna se queda con lo suyo: primero lo que falta publicar y al final
  // lo ya publicado, que es el orden en que lo mira quien administra la cuenta.
  const porRed = useMemo(() => {
    const peso = { programado: 0, borrador: 1, publicado: 2 } as const;
    const mapa = new Map<string, SocialPost[]>();
    for (const c of cuentas) mapa.set(c.red, []);
    for (const p of state.socialPosts) mapa.get(p.red)?.push(p);
    for (const lista of mapa.values()) {
      lista.sort((a, b) => peso[a.estado] - peso[b.estado] || a.fecha.localeCompare(b.fecha));
    }
    return mapa;
  }, [cuentas, state.socialPosts]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Redes sociales</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            Programa, publica y revisa cómo queda en cada red
          </p>
        </div>
        <button
          onClick={() => setComponiendo(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
        >
          <PenSquare size={14} />
          Nueva publicación
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface px-5 py-4">
        <div className="grid gap-4 lg:grid-cols-3">
          {cuentas.map((c) => (
            <ColumnaRed
              key={c.red}
              cuenta={c}
              posts={porRed.get(c.red) ?? []}
              onVerPreview={setPreview}
            />
          ))}
        </div>
      </div>

      {componiendo && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16"
          onClick={() => setComponiendo(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-sm font-bold">Nueva publicación</h2>
              <button
                onClick={() => setComponiendo(false)}
                className="rounded-lg p-1 text-[var(--text-3)] transition-colors hover:bg-surface"
              >
                <X size={16} />
              </button>
            </div>
            <PostComposer
              enModal
              onProgramar={(red, texto, fecha) => {
                dispatch({ type: "ADD_SOCIAL_POST", red, texto, fecha });
                setComponiendo(false);
              }}
            />
          </div>
        </div>
      )}

      {preview && (
        <PreviewModal
          post={{
            red: preview.red,
            texto: preview.texto,
            imagenes: imagenesDe(preview),
            fecha: preview.fecha,
            engagement: preview.engagement,
          }}
          cuentas={cuentas}
          marca={activeTenant().brand.nombre}
          iniciales={activeTenant().brand.nombre.slice(0, 2).toUpperCase()}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
