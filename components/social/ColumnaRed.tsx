"use client";

// Una columna por red: sus números arriba y sus publicaciones abajo.
//
// POR QUÉ ASÍ: agrupar por estado (programadas, publicadas, borradores) mezcla
// las tres redes en la misma lista, y para revisar una cuenta hay que ir
// saltando. Con una columna por red se lee de arriba abajo: cómo va la cuenta
// y qué se publicó ahí.

import { RedBadge } from "@/components/ui/RedBadge";
import { compacto } from "@/lib/format";
import { imagenesDe, metricasDeCuenta } from "@/lib/social";
import type { SocialPost, SocialStats } from "@/lib/data/types";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fechaPost(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split("-");
  return `${Number(dia)} ${MESES[Number(mes) - 1]} · ${iso.slice(11, 16)}`;
}

const ESTADO: Record<SocialPost["estado"], { texto: string; clase: string }> = {
  publicado: { texto: "Publicada", clase: "text-[#2f9e2f] bg-emerald-50" },
  programado: { texto: "Programada", clase: "text-brand bg-[var(--brand-tint)]" },
  borrador: { texto: "Borrador", clase: "text-[var(--text-3)] bg-surface-2" },
};

export function ColumnaRed({
  cuenta,
  posts,
  onVerPreview,
}: {
  cuenta: SocialStats;
  posts: SocialPost[];
  onVerPreview: (post: SocialPost) => void;
}) {
  const metricas = metricasDeCuenta(cuenta);

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="rounded-xl border border-line bg-card p-3.5 shadow-sm">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <RedBadge red={cuenta.red} showLabel />
          <span className="truncate text-[12px] text-[var(--text-3)]">{cuenta.handle}</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-[26px] font-extrabold leading-none tracking-tight">
            {compacto(cuenta.seguidores)}
          </span>
          <span className="text-[12px] text-[var(--text-3)]">
            seguidores · +{compacto(cuenta.nuevosSeguidores)} este mes
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {metricas.map((m) => (
            <div key={m.clave} className="rounded-lg bg-surface px-2 py-1.5">
              <p className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                {m.label}
              </p>
              <p className="text-[15px] font-bold leading-tight">{compacto(m.valor)}</p>
            </div>
          ))}
        </div>
      </header>

      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-3.5 py-6 text-center text-[12.5px] text-[var(--text-3)]">
          Todavía no hay publicaciones en esta cuenta.
        </p>
      ) : (
        posts.map((p) => {
          const fotos = imagenesDe(p);
          const estado = ESTADO[p.estado];
          return (
            <article
              key={p.id}
              className="rounded-xl border border-line bg-card p-3.5 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${estado.clase}`}
                >
                  {estado.texto}
                </span>
                <span className="text-[11.5px] text-[var(--text-3)]">{fechaPost(p.fecha)}</span>
              </div>

              {fotos.length > 0 && (
                <div className="mb-2.5 flex gap-1.5">
                  {fotos.slice(0, 3).map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className={`h-20 rounded-lg border border-line object-cover ${i === 0 ? "flex-[2]" : "flex-1"}`}
                    />
                  ))}
                  {fotos.length > 3 && (
                    <span className="flex h-20 w-9 shrink-0 items-center justify-center rounded-lg border border-line text-[12px] text-[var(--text-3)]">
                      +{fotos.length - 3}
                    </span>
                  )}
                </div>
              )}

              <p className="text-[13px] leading-relaxed text-[var(--text-2)]">{p.texto}</p>

              <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-2)]">
                  <PostMetricas post={p} />
                </div>
                <button
                  onClick={() => onVerPreview(p)}
                  title="Ver cómo queda publicado"
                  className="shrink-0 rounded-md border border-line px-2 py-0.5 text-[11.5px] font-semibold text-brand transition-colors hover:bg-[var(--brand-tint)]"
                >
                  Vista previa
                </button>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}

function PostMetricas({ post }: { post: SocialPost }) {
  const e = post.engagement;
  if (!e) return null;
  const pares: Array<[string, number | undefined]> =
    post.red === "tiktok"
      ? [
          ["vistas", e.vistas],
          ["me gusta", e.meGusta],
          ["compartidos", e.compartidos],
        ]
      : [
          ["alcance", e.alcance],
          ["me gusta", e.meGusta],
          ["comentarios", e.comentarios],
        ];
  return (
    <>
      {pares
        .filter(([, v]) => typeof v === "number")
        .map(([label, v]) => (
          <span key={label}>
            <span className="font-semibold">{compacto(v as number)}</span>{" "}
            <span className="text-[var(--text-3)]">{label}</span>
          </span>
        ))}
    </>
  );
}
