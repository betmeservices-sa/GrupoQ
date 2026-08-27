"use client";

// Los archivos pegados a la ficha: comprobantes de pago y lo que mandó por
// WhatsApp. Las imágenes se ven en grande ahí mismo.

import { useEffect, useState } from "react";
import { FileText, Paperclip } from "lucide-react";
import { ImagenAmpliable } from "@/components/ui/Lightbox";

interface Adjunto {
  id: number | string;
  tipo: string;
  mime: string | null;
  filename: string | null;
  caption: string | null;
  ts: string;
  url: string | null;
}

function fecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-SV", { day: "numeric", month: "short", year: "numeric" });
}

export function Archivos({ from }: { from: string }) {
  const [lista, setLista] = useState<Adjunto[] | null>(null);
  useEffect(() => {
    let vivo = true;
    setLista(null);
    fetch(`/api/contactos/adjuntos?from=${encodeURIComponent(from)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean; adjuntos?: Adjunto[] }) => {
        if (vivo) setLista(d.ok ? (d.adjuntos ?? []) : []);
      })
      .catch(() => {
        if (vivo) setLista([]);
      });
    return () => {
      vivo = false;
    };
  }, [from]);

  if (lista === null) return <p className="px-1 text-[12.5px] text-[var(--text-3)]">Buscando archivos...</p>;
  if (lista.length === 0) return <p className="px-1 text-[12.5px] text-[var(--text-3)]">Sin archivos todavía. Los comprobantes de pago que mande quedan acá.</p>;

  return (
    <ul className="grid grid-cols-2 gap-2 px-1 sm:grid-cols-3">
      {lista.map((a) => {
        const esImagen = a.tipo === "image" || (a.mime ?? "").startsWith("image/");
        return (
          <li key={a.id} className="overflow-hidden rounded-xl border border-line bg-surface/60">
            {esImagen && a.url ? (
              <ImagenAmpliable src={a.url} alt={a.caption ?? a.filename ?? "Imagen"} className="aspect-square w-full" title={a.caption ?? undefined} />
            ) : (
              <a
                href={a.url ?? "#"}
                target="_blank"
                rel="noreferrer"
                className="flex aspect-square w-full flex-col items-center justify-center gap-1 text-[var(--text-3)]"
              >
                {a.tipo === "document" ? <FileText size={22} /> : <Paperclip size={22} />}
                <span className="px-2 text-center text-[11px]">{a.filename ?? a.tipo}</span>
              </a>
            )}
            <p className="truncate px-2 py-1.5 text-[11px] text-[var(--text-3)]" title={a.caption ?? undefined}>
              {a.caption ?? a.filename ?? a.tipo} · {fecha(a.ts)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
