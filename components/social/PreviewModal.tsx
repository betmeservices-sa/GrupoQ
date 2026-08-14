"use client";

// Ventana de vista previa: la misma publicación puesta en las tres redes, para
// ver de un vistazo qué recorta cada una antes de darle publicar.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { REDES, RED_NOMBRE, cuentaDe } from "@/lib/social";
import { RED_ICONO } from "@/components/ui/RedBadge";
import { PostPreview, type PreviewPost } from "@/components/social/PostPreview";
import type { RedSocial, SocialStats } from "@/lib/data/types";

export function PreviewModal({
  post,
  cuentas,
  marca,
  iniciales,
  onClose,
}: {
  post: PreviewPost;
  cuentas: SocialStats[];
  marca: string;
  iniciales: string;
  onClose: () => void;
}) {
  const [red, setRed] = useState<RedSocial>(post.red);

  useEffect(() => {
    setRed(post.red);
  }, [post.red]);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="my-auto w-full max-w-[560px] overflow-hidden rounded-2xl border border-line bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[14px] font-bold text-[var(--text)]">Así se va a ver</h2>
          <div className="ml-auto flex items-center gap-1">
            {REDES.map((r) => {
              const { Icon } = RED_ICONO[r];
              const activo = red === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRed(r)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition",
                    activo
                      ? "bg-brand text-white"
                      : "text-[var(--text-3)] hover:bg-surface hover:text-[var(--text-2)]",
                  )}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{RED_NOMBRE[r]}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-3)] transition hover:bg-surface hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex justify-center bg-surface px-4 py-5">
          <PostPreview
            post={post}
            red={red}
            cuenta={{ nombre: cuentaDe(cuentas, red, marca), iniciales }}
          />
        </div>

        {post.red !== red && (
          <p className="border-t border-line px-4 py-2.5 text-[12px] text-[var(--text-3)]">
            Esta publicación está armada para {RED_NOMBRE[post.red]}. Así quedaría el mismo
            contenido en {RED_NOMBRE[red]}.
          </p>
        )}
      </div>
    </div>
  );
}
