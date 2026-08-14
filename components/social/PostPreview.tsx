/* eslint-disable @next/next/no-img-element */
"use client";

// Cómo se ve la publicación una vez publicada, imitando el formato nativo de
// cada red: la misma foto y el mismo texto se ven distinto en Facebook, en
// Instagram y en TikTok, y eso es lo que hay que ver ANTES de publicar.
//
// Los colores de estas tarjetas son los de cada red, no los del cliente: es un
// calco del feed ajeno, no una pantalla de la marca. Lo único que sí sale del
// tenant es la foto de perfil (su color de marca) y el nombre de la cuenta.

import { useEffect, useState } from "react";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Globe,
  Heart,
  ImageOff,
  MessageCircle,
  MoreHorizontal,
  Music2,
  Play,
  Plus,
  Send,
  Share2,
  ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { compacto } from "@/lib/format";
import {
  CORTE_RED,
  RATIOS_INSTAGRAM,
  RATIO_RED,
  cortarTexto,
  fechaEnRed,
} from "@/lib/social";
import type { PostEngagement, RedSocial } from "@/lib/data/types";

export interface PreviewPost {
  red: RedSocial;
  texto: string;
  imagenes: string[];
  fecha: string;
  engagement?: PostEngagement;
}

export interface PreviewCuenta {
  nombre: string;
  iniciales: string;
}

// Las redes no usan la tipografía del cliente: usan la del sistema. Sin esto la
// vista previa se vería con la letra de la marca y dejaría de parecer el feed.
const FUENTE = "system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";

export function PostPreview({
  post,
  cuenta,
  red,
}: {
  post: PreviewPost;
  cuenta: PreviewCuenta;
  red: RedSocial;
}) {
  if (red === "instagram") return <EnInstagram post={post} cuenta={cuenta} />;
  if (red === "tiktok") return <EnTiktok post={post} cuenta={cuenta} />;
  return <EnFacebook post={post} cuenta={cuenta} />;
}

// ── Piezas compartidas ──

function Foto({ src, ratio, className }: { src: string; ratio: string; className?: string }) {
  return (
    <div className={cn("w-full overflow-hidden bg-black/5", className)} style={{ aspectRatio: ratio }}>
      <img src={src} alt="" className="h-full w-full object-cover" />
    </div>
  );
}

function Perfil({ iniciales, size }: { iniciales: string; size: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: "var(--brand-blue)",
      }}
      aria-hidden
    >
      {iniciales}
    </span>
  );
}

function Texto({
  texto,
  limite,
  masLabel,
  className,
  masClassName,
}: {
  texto: string;
  limite: number;
  masLabel: string;
  className?: string;
  masClassName?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const { visible, cortado } = cortarTexto(texto, limite);
  return (
    <span className={className}>
      {abierto || !cortado ? texto : `${visible}… `}
      {cortado && !abierto && (
        <button type="button" onClick={() => setAbierto(true)} className={masClassName}>
          {masLabel}
        </button>
      )}
    </span>
  );
}

// Carrusel: la flecha solo aparece cuando hay a dónde ir.
function useCarrusel(total: number) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
  }, [total]);
  return {
    i: Math.min(i, Math.max(total - 1, 0)),
    ir: (delta: number) => setI((x) => Math.min(Math.max(x + delta, 0), total - 1)),
    saltar: setI,
  };
}

function SinImagen({ red, oscuro = false }: { red: string; oscuro?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center",
        oscuro ? "text-white/70" : "border-y border-dashed border-black/15 bg-black/[0.03] text-black/50",
      )}
    >
      <ImageOff size={22} />
      <p className="text-[12.5px] leading-snug">
        {red} no publica sin imagen. Elige una foto para ver cómo queda.
      </p>
    </div>
  );
}

// ── Facebook ──

function EnFacebook({ post, cuenta }: { post: PreviewPost; cuenta: PreviewCuenta }) {
  const e = post.engagement;
  const n = post.imagenes.length;
  return (
    <article className="w-full max-w-[420px] overflow-hidden rounded-lg bg-white text-[#050505] shadow-[0_1px_2px_rgba(0,0,0,0.2)]">
      <div className="flex items-center gap-2 px-3 pt-3">
        <Perfil iniciales={cuenta.iniciales} size={40} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold leading-tight">{cuenta.nombre}</p>
          <p className="flex items-center gap-1 text-[12px] text-[#65676b]">
            {fechaEnRed(post.fecha, "facebook")}
            <span>·</span>
            <Globe size={11} />
          </p>
        </div>
        <MoreHorizontal size={20} className="ml-auto shrink-0 text-[#65676b]" />
      </div>

      <p className="px-3 pb-2.5 pt-2 text-[15px] leading-[1.34]">
        <Texto
          texto={post.texto}
          limite={CORTE_RED.facebook}
          masLabel="Ver más"
          masClassName="text-[#65676b] hover:underline"
        />
      </p>

      {n === 0 ? null : n === 1 ? (
        <Foto src={post.imagenes[0]} ratio={RATIO_RED.facebook} />
      ) : n === 2 ? (
        <div className="grid grid-cols-2 gap-0.5">
          {post.imagenes.map((src) => (
            <Foto key={src} src={src} ratio="1 / 1" />
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          <Foto src={post.imagenes[0]} ratio="16 / 9" />
          <div className="grid grid-cols-3 gap-0.5">
            {post.imagenes.slice(1, 4).map((src, i) => (
              <div key={src} className="relative">
                <Foto src={src} ratio="1 / 1" />
                {i === 2 && n > 4 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[18px] font-bold text-white">
                    +{n - 4}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {e && (
        <div className="flex items-center justify-between px-3 py-2 text-[13px] text-[#65676b]">
          <span className="flex items-center gap-1">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#1877F2] text-white">
              <ThumbsUp size={10} fill="currentColor" />
            </span>
            <span className="-ml-2 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#f3425f] text-white ring-2 ring-white">
              <Heart size={10} fill="currentColor" />
            </span>
            <span className="ml-1">{compacto(e.meGusta)}</span>
          </span>
          <span>
            {compacto(e.comentarios)} comentarios · {compacto(e.compartidos)} veces compartido
          </span>
        </div>
      )}

      <div className="mx-3 border-t border-[#ced0d4]" />
      <div className="flex px-1.5 py-1">
        {[
          { Icon: ThumbsUp, label: "Me gusta" },
          { Icon: MessageCircle, label: "Comentar" },
          { Icon: Share2, label: "Compartir" },
        ].map(({ Icon, label }) => (
          <span
            key={label}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[14px] font-semibold text-[#65676b]"
          >
            <Icon size={17} />
            {label}
          </span>
        ))}
      </div>
    </article>
  );
}

// ── Instagram ──

function EnInstagram({ post, cuenta }: { post: PreviewPost; cuenta: PreviewCuenta }) {
  const [ratio, setRatio] = useState<string>(RATIO_RED.instagram);
  const e = post.engagement;
  const total = post.imagenes.length;
  const car = useCarrusel(total);

  return (
    <div className="w-full max-w-[380px]">
      <div className="mb-2 flex items-center justify-end gap-1">
        {RATIOS_INSTAGRAM.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRatio(r.ratio)}
            className={cn(
              "rounded-md px-2 py-1 text-[11.5px] font-bold transition",
              ratio === r.ratio
                ? "bg-brand text-white"
                : "border border-line text-[var(--text-3)] hover:text-[var(--text-2)]",
            )}
          >
            {r.id}
          </button>
        ))}
      </div>

      <article className="overflow-hidden rounded-[4px] border border-[#dbdbdb] bg-white text-[#262626]">
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <span className="rounded-full bg-gradient-to-tr from-[#fdc468] via-[#e1306c] to-[#833ab4] p-[2px]">
            <span className="block rounded-full bg-white p-[2px]">
              <Perfil iniciales={cuenta.iniciales} size={28} />
            </span>
          </span>
          <p className="min-w-0 truncate text-[13.5px] font-semibold">{cuenta.nombre}</p>
          <MoreHorizontal size={18} className="ml-auto shrink-0 text-[#262626]" />
        </div>

        <div className="relative bg-[#fafafa]" style={{ aspectRatio: ratio }}>
          {total === 0 ? (
            <SinImagen red="Instagram" />
          ) : (
            <>
              <img
                src={post.imagenes[car.i]}
                alt=""
                className="h-full w-full object-cover"
              />
              {total > 1 && (
                <>
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11.5px] font-semibold text-white">
                    {car.i + 1}/{total}
                  </span>
                  {car.i > 0 && (
                    <FlechaIg lado="izq" onClick={() => car.ir(-1)} />
                  )}
                  {car.i < total - 1 && (
                    <FlechaIg lado="der" onClick={() => car.ir(1)} />
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-3.5 px-3 pt-2.5">
          <Heart size={22} strokeWidth={1.7} />
          <MessageCircle size={22} strokeWidth={1.7} className="-scale-x-100" />
          <Send size={21} strokeWidth={1.7} />
          {total > 1 && (
            <span className="flex flex-1 items-center justify-center gap-1">
              {post.imagenes.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => car.saltar(i)}
                  aria-label={`Foto ${i + 1}`}
                  className={cn(
                    "h-[6px] w-[6px] rounded-full transition",
                    i === car.i ? "bg-[#0095f6]" : "bg-[#c7c7c7]",
                  )}
                />
              ))}
            </span>
          )}
          <Bookmark size={22} strokeWidth={1.7} className={cn(total > 1 ? "" : "ml-auto")} />
        </div>

        <div className="px-3 pb-3 pt-2 text-[13.5px] leading-[1.4]">
          {e && <p className="font-semibold">{compacto(e.meGusta)} me gusta</p>}
          <p className="mt-0.5">
            <span className="font-semibold">{cuenta.nombre}</span>{" "}
            <Texto
              texto={post.texto}
              limite={CORTE_RED.instagram}
              masLabel="más"
              masClassName="text-[#8e8e8e]"
            />
          </p>
          {e && e.comentarios > 0 && (
            <p className="mt-1 text-[13.5px] text-[#8e8e8e]">
              Ver los {compacto(e.comentarios)} comentarios
            </p>
          )}
          <p className="mt-1.5 text-[10.5px] tracking-wide text-[#8e8e8e]">
            {fechaEnRed(post.fecha, "instagram")}
          </p>
        </div>
      </article>
    </div>
  );
}

function FlechaIg({ lado, onClick }: { lado: "izq" | "der"; onClick: () => void }) {
  const Icon = lado === "izq" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={lado === "izq" ? "Foto anterior" : "Foto siguiente"}
      className={cn(
        "absolute top-1/2 flex h-[26px] w-[26px] -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#262626] shadow transition hover:bg-white",
        lado === "izq" ? "left-2" : "right-2",
      )}
    >
      <Icon size={18} />
    </button>
  );
}

// ── TikTok ──

function EnTiktok({ post, cuenta }: { post: PreviewPost; cuenta: PreviewCuenta }) {
  const e = post.engagement;
  const total = post.imagenes.length;
  const car = useCarrusel(total);
  const handle = cuenta.nombre.startsWith("@")
    ? cuenta.nombre
    : `@${cuenta.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;

  return (
    <article
      className="relative w-[268px] shrink-0 overflow-hidden rounded-2xl bg-black text-white shadow-lg"
      style={{ aspectRatio: RATIO_RED.tiktok }}
    >
      {total === 0 ? (
        <div className="absolute inset-0 bg-gradient-to-b from-[#25f4ee]/15 via-black to-[#fe2c55]/15">
          <SinImagen red="TikTok" oscuro />
        </div>
      ) : (
        <img src={post.imagenes[car.i]} alt="" className="absolute inset-0 h-full w-full object-cover" />
      )}

      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="absolute inset-x-0 top-3 flex items-center justify-center gap-4 text-[13px] font-semibold">
        <span className="text-white/60">Siguiendo</span>
        <span className="border-b-2 border-white pb-0.5">Para ti</span>
      </div>

      {total > 1 && (
        <div className="absolute inset-x-0 top-11 flex justify-center gap-1">
          {post.imagenes.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => car.saltar(i)}
              aria-label={`Foto ${i + 1}`}
              className={cn(
                "h-[3px] w-6 rounded-full transition",
                i === car.i ? "bg-white" : "bg-white/35",
              )}
            />
          ))}
        </div>
      )}

      <div className="absolute bottom-3 right-2 flex w-12 flex-col items-center gap-3.5">
        <span className="relative mb-1">
          <span className="block rounded-full ring-2 ring-white">
            <Perfil iniciales={cuenta.iniciales} size={38} />
          </span>
          <span className="absolute -bottom-1.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-[#fe2c55]">
            <Plus size={11} strokeWidth={3} />
          </span>
        </span>
        <Accion Icon={Heart} valor={e?.meGusta} relleno />
        <Accion Icon={MessageCircle} valor={e?.comentarios} relleno />
        <Accion Icon={Share2} valor={e?.compartidos} />
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
          <Music2 size={15} />
        </span>
      </div>

      <div className="absolute bottom-4 left-3 w-[190px]">
        <p className="text-[14px] font-bold">{handle}</p>
        <p className="mt-1 text-[12.5px] leading-snug text-white/95">
          <Texto
            texto={post.texto}
            limite={CORTE_RED.tiktok}
            masLabel="ver más"
            masClassName="font-semibold text-white/70"
          />
        </p>
        {e?.vistas !== undefined && (
          <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11.5px] font-semibold">
            <Play size={10} fill="currentColor" />
            {compacto(e.vistas)}
          </p>
        )}
      </div>
    </article>
  );
}

function Accion({
  Icon,
  valor,
  relleno = false,
}: {
  Icon: typeof Heart;
  valor?: number;
  relleno?: boolean;
}) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <Icon
        size={25}
        fill={relleno ? "currentColor" : "none"}
        strokeWidth={relleno ? 0 : 2}
      />
      <span className="text-[11px] font-semibold">{valor === undefined ? "" : compacto(valor)}</span>
    </span>
  );
}
