"use client";

// Las redes, resumidas en el dashboard.
//
// Hasta ahora las estadísticas vivían solo dentro de la pestaña Redes, así que
// el dueño tenía que ir a buscarlas. Acá quedan donde mira primero, con la
// misma fuente: las reales de las cuentas conectadas, o el seed del tenant
// mientras no haya conexión.
//
// TikTok entra igual que las otras dos, pero mide distinto y por eso se muestra
// distinto: en Meta lo que importa es el alcance, en TikTok son las vistas. Un
// panel que enseñara "alcance" en TikTok estaría inventando un número.

import { useEffect, useState } from "react";
import { Facebook, Instagram, Music2, TrendingDown, TrendingUp } from "lucide-react";
import { useStore } from "@/lib/store";
import { RED_NOMBRE } from "@/lib/social";
import type { RedSocial, SocialStats } from "@/lib/data/types";

const ICONO: Record<RedSocial, typeof Facebook> = {
  facebook: Facebook,
  instagram: Instagram,
  // lucide no trae logo de TikTok; la nota musical es lo que mejor lo evoca.
  tiktok: Music2,
};

const COLOR: Record<RedSocial, string> = {
  facebook: "#1877F2",
  instagram: "#E1306C",
  tiktok: "#00F2EA",
};

const miles = (n: number) =>
  n >= 1_000_000
    ? (n / 1_000_000).toFixed(1).replace(".0", "") + "M"
    : n >= 1000
      ? (n / 1000).toFixed(1).replace(".0", "") + "k"
      : String(n);

export function RedesResumen() {
  const { state } = useStore();
  const [reales, setReales] = useState<SocialStats[] | null>(null);
  const [demo, setDemo] = useState(true);

  useEffect(() => {
    const tenant = window.localStorage.getItem("ccg.tenant") || "x";
    const cacheKey = `ccg.meta.stats.${tenant}`;
    // Se pinta al instante lo último guardado para no parpadear del seed a lo
    // real en cada carga.
    try {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        setReales(JSON.parse(cached));
        setDemo(false);
      }
    } catch {}
    fetch("/api/meta/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && !d.demo && d.stats?.length) {
          setReales(d.stats);
          setDemo(false);
          try {
            window.localStorage.setItem(cacheKey, JSON.stringify(d.stats));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const stats = reales ?? state.socialStats;
  if (!stats || stats.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[14px] font-bold text-brand">Redes sociales</h2>
        <p className="text-[12px] text-[var(--text-3)]">
          Últimos 30 días
          {demo && " · cifras de demostración hasta conectar las cuentas"}
        </p>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => {
          const Icon = ICONO[s.red];
          const sube = s.crecimientoPct >= 0;
          const Flecha = sube ? TrendingUp : TrendingDown;
          return (
            <div key={s.red + s.handle} className="rounded-xl border border-line bg-[var(--bg-2,#f8fafc)] p-3.5">
              <div className="flex items-center gap-2">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: `${COLOR[s.red]}1a`, color: COLOR[s.red] }}
                >
                  <Icon size={15} />
                </span>
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold leading-tight text-[var(--text-1)]">
                    {RED_NOMBRE[s.red]}
                  </p>
                  <p className="truncate text-[11px] text-[var(--text-3)]">{s.handle}</p>
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[22px] font-bold leading-none tabular-nums text-[var(--text-1)]">
                  {miles(s.seguidores)}
                </span>
                <span className="text-[11.5px] text-[var(--text-3)]">seguidores</span>
              </div>

              <div className="mt-1.5 flex items-center gap-1.5">
                <Flecha size={12} className={sube ? "text-[#2f9e2f]" : "text-[var(--bad-fg,#991b1b)]"} />
                <span
                  className={
                    sube
                      ? "text-[11.5px] font-semibold tabular-nums text-[#2f9e2f]"
                      : "text-[11.5px] font-semibold tabular-nums text-[var(--bad-fg,#991b1b)]"
                  }
                >
                  {sube ? "+" : ""}
                  {s.crecimientoPct.toFixed(1)}%
                </span>
                <span className="text-[11px] text-[var(--text-3)]">
                  {sube ? "+" : ""}
                  {miles(s.nuevosSeguidores)} nuevos
                </span>
              </div>

              {/* Cada red se mide con lo suyo. En Meta el número que importa es
                  el alcance; en TikTok, las vistas. */}
              <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2.5">
                <Dato label="Vistas" valor={miles(s.vistas30d)} />
                {s.alcance30d !== undefined && <Dato label="Alcance" valor={miles(s.alcance30d)} />}
                {s.interacciones30d !== undefined && (
                  <Dato label="Interacciones" valor={miles(s.interacciones30d)} />
                )}
                {s.meGusta30d !== undefined && <Dato label="Me gusta" valor={miles(s.meGusta30d)} />}
                {s.comentarios30d !== undefined && (
                  <Dato label="Comentarios" valor={miles(s.comentarios30d)} />
                )}
              </dl>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-wide text-[var(--text-3)]">{label}</dt>
      <dd className="text-[13px] font-semibold tabular-nums text-[var(--text-2)]">{valor}</dd>
    </div>
  );
}
