import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Radar,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
} from "lucide-react";
import { ChannelBadge } from "@/components/ui/ChannelBadge";
import { compacto } from "@/lib/format";
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
  { estado: "borrador", titulo: "Borradores", Icon: FileText, tone: "text-[#94a3b4]" },
] as const;

export function PostList({ posts }: { posts: SocialPost[] }) {
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
              <span className="text-[#94a3b4]">({grupo.length})</span>
            </h2>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {grupo.map((p) => (
                <article
                  key={p.id}
                  className="rounded-xl border border-line bg-card p-3.5 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <ChannelBadge channel={p.red} showLabel />
                    <span className="text-[11.5px] text-[#94a3b4]">{fechaPost(p.fecha)}</span>
                  </div>
                  <p className="text-[13.5px] leading-relaxed text-[#33425a]">{p.texto}</p>
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

function Engagement({ e }: { e: PostEngagement }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3.5 gap-y-1.5 border-t border-line pt-2.5 text-[12px] text-[#5b6b80]">
      <Stat Icon={Radar} valor={compacto(e.alcance)} titulo="Alcance" />
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
      <Icon size={13} className="text-[#94a3b4]" />
      <span className="font-semibold text-[#33425a]">{valor}</span>
    </span>
  );
}
