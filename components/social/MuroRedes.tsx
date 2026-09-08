"use client";

// El muro de la semana: Facebook e Instagram, uno al lado del otro.
//
// Grupo Q no programa contenido desde acá, lo mira. Por eso no hay composer ni
// botón de vista previa: la publicación se ve como se ve en la red, con su foto
// y sus números debajo. Un clic menos para la única cosa que se venía a hacer.
//
// Solo los últimos siete días: un muro que arrastra meses deja de ser un
// reporte y se vuelve un archivo.

import { useMemo } from "react";
import { Eye, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { PostPreview } from "@/components/social/PostPreview";
import { RED_ICONO } from "@/components/ui/RedBadge";
import { imagenesDe } from "@/lib/social";
import type { RedSocial, SocialPost, SocialStats } from "@/lib/data/types";

const DIA = 86_400_000;
export const DIAS_MURO = 7;

/** Las dos redes del muro, en el orden en que las mira el cliente. */
const COLUMNAS: RedSocial[] = ["facebook", "instagram"];

const num = (n: number | undefined) =>
  n === undefined ? "·" : n >= 1000 ? `${(n / 1000).toFixed(1).replace(".0", "")}k` : String(n);

function Numeros({ post }: { post: SocialPost }) {
  const e = post.engagement;
  if (!e) return null;
  const items: { Icon: typeof Eye; valor: string; titulo: string }[] = [
    { Icon: Eye, valor: num(e.alcance ?? e.vistas), titulo: "Alcance" },
    { Icon: Heart, valor: num(e.meGusta), titulo: "Me gusta" },
    { Icon: MessageCircle, valor: num(e.comentarios), titulo: "Comentarios" },
    { Icon: Repeat2, valor: num(e.compartidos), titulo: "Compartidos" },
  ];
  return (
    <div className="flex items-center gap-4 border-t border-line bg-surface/60 px-3 py-2">
      {items.map(({ Icon, valor, titulo }) => (
        <span key={titulo} title={titulo} className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-2)]">
          <Icon size={13} className="text-[var(--text-3)]" />
          <span className="font-bold tabular-nums text-[var(--text)]">{valor}</span>
        </span>
      ))}
    </div>
  );
}

export function MuroRedes({
  cuentas,
  posts,
  marca,
  iniciales,
}: {
  cuentas: SocialStats[];
  posts: SocialPost[];
  marca: string;
  iniciales: string;
}) {
  const desde = Date.now() - DIAS_MURO * DIA;

  const porRed = useMemo(() => {
    const mapa = new Map<RedSocial, SocialPost[]>();
    for (const red of COLUMNAS) {
      mapa.set(
        red,
        posts
          .filter((p) => p.red === red && p.estado === "publicado" && Date.parse(p.fecha) >= desde)
          .sort((a, b) => b.fecha.localeCompare(a.fecha)),
      );
    }
    return mapa;
  }, [posts, desde]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {COLUMNAS.map((red) => {
        const { Icon, tono } = RED_ICONO[red];
        const lista = porRed.get(red) ?? [];
        const cuenta = cuentas.find((c) => c.red === red);
        return (
          <section key={red} className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className={"flex h-7 w-7 items-center justify-center rounded-lg " + tono}>
                <Icon size={15} />
              </span>
              <h2 className="text-[13.5px] font-bold text-[var(--text)]">
                {cuenta?.handle ?? (red === "facebook" ? "Facebook" : "Instagram")}
              </h2>
              <span className="ml-auto text-[11.5px] text-[var(--text-3)]">
                {lista.length} {lista.length === 1 ? "publicación" : "publicaciones"}
              </span>
            </div>

            {lista.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-[var(--text-3)]">
                Nada publicado en los últimos {DIAS_MURO} días.
              </p>
            ) : (
              <div className="space-y-4">
                {lista.map((p) => (
                  <article
                    key={p.id}
                    className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm"
                  >
                    <PostPreview
                      red={red}
                      cuenta={{ nombre: marca, iniciales }}
                      post={{
                        red,
                        texto: p.texto,
                        imagenes: imagenesDe(p),
                        fecha: p.fecha,
                        engagement: p.engagement,
                      }}
                    />
                    <Numeros post={p} />
                  </article>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
