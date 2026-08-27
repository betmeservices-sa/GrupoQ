"use client";

// Ver una imagen en grande sin salir del panel.
//
// Antes las fotos abrían en otra pestaña, y las que sirve Meta vienen con
// cabecera de descarga: un clic bajaba el comprobante al disco en vez de
// mostrarlo. Acá se abre encima de todo, se cierra con Escape o con un clic.

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Lightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", alTeclear);
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = antes;
    };
  }, [onClose]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt ?? "Imagen"}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <X size={20} />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
      />
    </div>
  );
}

/** Una imagen (o cualquier cosa) que al tocarla se ve en grande. */
export function ImagenAmpliable({
  src,
  alt,
  className,
  children,
  title,
}: {
  src: string;
  alt?: string;
  className?: string;
  children?: ReactNode;
  title?: string;
}) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        title={title ?? "Ver en grande"}
        className={cn("block cursor-zoom-in text-left", className)}
      >
        {children ?? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} alt={alt ?? ""} className="h-full w-full rounded-lg object-cover" />
        )}
      </button>
      {abierta && <Lightbox src={src} alt={alt} onClose={() => setAbierta(false)} />}
    </>
  );
}
