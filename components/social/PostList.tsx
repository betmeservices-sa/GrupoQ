import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Radar,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Eye,
} from "lucide-react";
import { RedBadge } from "@/components/ui/RedBadge";
import { compacto } from "@/lib/format";
import { imagenesDe } from "@/lib/social";
import type { PostEngagement, SocialPost } from "@/lib/data/types";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fechaPost(iso: string): string {
  const fecha = iso.slice(0, 10);
  const [, mes, dia] = fecha.split("-");
  const hhmm = iso.slice(11, 16);
  return `${Number(dia)} ${MESES[Number(mes) - 1]} · ${hhmm}`;
}

const GRUPOS = [
  { estado: "programado", titulo: "Programadas", Icon: CalendarClock, tone: "text-brand" },
  { estado: "publicado", titulo: "Publicadas", Icon: CheckCircle2, tone: "text-[#2f9e2f]" },
  { estado: "borrador", titulo: "Borradores", Icon: FileText, tone: "text-[var(--text-3)]" },
] as const;

export function PostList({
  posts,
  onVerPreview,
}: {
  posts: SocialPost[];
  onVerPreview?: (post: SocialPost) => void;
}) {
  return (
    <div className="flex-1 space-y-6 px-5 py-5 lg:overflow-y-auto">
      {GRUPOS.map(({ estado, titulo, Icon, tone }) => {
        const grupo = posts.filter((p) => p.estado === estado);
        if (grupo.length === 0) return null;
        return (
          <section key={estado}>
            <h2 className={`mb-2.5 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-wide ${tone}`}>
              <Icon size={15} />
              {titulo}
              <span className="text-[var(--text-3)]">({grupo.length})</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {grupo.map((p) => (
                <article
                  key={p.id}
                  className="rounded-xl border border-line bg-card p-3.5 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <RedBadge red={p.red} showLabel />
                    <div className="flex items-center gap-2.5">
                      <span className="text-[11.5px] text-[var(--text-3)]">{fechaPost(p.fecha)}</span>
                      {onVerPreview && (
                        <button
                          onClick={() => onVerPreview(p)}
                          title="Ver cómo queda publicado"
                          className="rounded-md border border-line px-2 py-0.5 text-[11.5px] font-semibold text-brand transition-colors hover:bg-[var(--brand-tint)]"
                        >
                          Vista previa
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-[var(--text-2)]">{p.texto}</p>
                  <Miniaturas urls={imagenesDe(p)} />
                  {p.engagement && <Engagement e={p.engagement} />}
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

// La primera foto manda, las demás se insinúan: en la lista interesa saber que
// el post lleva imagen y cuántas, no verlas todas.
function Miniaturas({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-2.5 flex gap-1.5">
      {urls.slice(0, 3).map((url, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={url}
          src={url}
          alt=""
          className={`h-16 rounded-lg border border-line object-cover ${i === 0 ? "w-24" : "w-16"}`}
        />
      ))}
      {urls.length > 3 && (
        <span className="flex h-16 w-10 items-center justify-center rounded-lg border border-line text-[12px] text-[var(--text-3)]">
          +{urls.length - 3}
        </span>
      )}
    </div>
  );
}

function Engagement({ e }: { e: PostEngagement }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-line pt-2.5 text-[12px] text-[var(--text-2)]">
      {/* En Meta se mide alcance; en TikTok, vistas. Cada post trae la suya. */}
      {e.alcance !== undefined && (
        <Stat Icon={Radar} valor={compacto(e.alcance)} titulo="Alcance" />
      )}
      {e.vistas !== undefined && <Stat Icon={Eye} valor={compacto(e.vistas)} titulo="Vistas" />}
      <Stat Icon={Heart} valor={compacto(e.meGusta)} titulo="Me gusta / reacciones" />
      <Stat Icon={MessageCircle} valor={compacto(e.comentarios)} titulo="Comentarios" />
      <Stat Icon={Share2} valor={compacto(e.compartidos)} titulo="Compartidos" />
      {e.guardados !== undefined && (
        <Stat Icon={Bookmark} valor={compacto(e.guardados)} titulo="Guardados" />
      )}
    </div>
  );
}

function Stat({
  Icon,
  valor,
  titulo,
}: {
  Icon: typeof Radar;
  valor: string;
  titulo: string;
}) {
  return (
    <span className="flex items-center gap-1" title={titulo}>
      <Icon size={13} className="text-[var(--text-3)]" />
      <span className="font-semibold text-[var(--text-2)]">{valor}</span>
    </span>
  );
}
