"use client";

import { useState, useRef, useEffect } from "react";
import { FileText, Smile } from "lucide-react";
import { NotaDeVoz } from "./NotaDeVoz";
import { cn } from "@/lib/cn";
import { captionDeMedia, horaDe, nombreStaff } from "@/lib/format";
import type { Message, MessageMedia } from "@/lib/data/types";

const EMOJIS = ["👍", "❤️", "🙏", "😊", "😮"];

// Reproduce/muestra el archivo recibido. El src va al proxy server-side que lo
// baja de Meta con el token (el navegador no puede usar el token directo).
function MediaContenido({ media }: { media: MessageMedia }) {
  // Las semillas de demostración traen el archivo servido por nosotros; lo que
  // llega de WhatsApp pasa por el proxy, que es quien tiene el token.
  const src = media.url ?? `/api/whatsapp/media/${media.id}`;
  if (media.tipo === "audio") return <NotaDeVoz src={src} />;
  if (media.tipo === "video") {
    return <video controls preload="none" src={src} className="max-h-64 max-w-full rounded-lg" />;
  }
  if (media.tipo === "image" || media.tipo === "sticker") {
    return (
      <a href={src} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Adjunto" className="max-h-64 max-w-full rounded-lg" />
      </a>
    );
  }
  // documento (PDF u otro)
  return (
    <a
      href={src}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 font-medium text-brand underline"
    >
      <FileText size={16} className="shrink-0" />
      {media.filename || "Abrir documento"}
    </a>
  );
}

export function MessageBubble({
  message,
  isNew,
  onReact,
}: {
  message: Message;
  isNew?: boolean;
  onReact?: (messageId: string, emoji: string) => void;
}) {
  const esStaff = message.autor === "staff";
  const caption = message.media ? captionDeMedia(message.texto) : null;

  // Respuesta a una historia. El rótulo va SIEMPRE que el mensaje lo diga, con
  // miniatura o sin ella: el enlace que da Meta vence en unas horas, y quedarse
  // sin foto no puede quedarse también sin la explicación de qué se contestó.
  const esRespuestaAHistoria = message.texto.startsWith("[respuesta a tu historia]");
  const textoLimpio = esRespuestaAHistoria
    ? message.texto.slice("[respuesta a tu historia]".length).trim()
    : message.texto;
  // Meta manda el enlace de la historia sin decir qué es. Muchas son videos, y
  // un video puesto como imagen da ícono roto. Se intenta como imagen; si no
  // carga, como video; si tampoco, queda el rótulo solo.
  const [historiaComo, setHistoriaComo] = useState<"imagen" | "video" | "nada">("imagen");
  const [abierto, setAbierto] = useState(false);
  const [reaccion, setReaccion] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Cierra el picker al hacer clic fuera de el.
  useEffect(() => {
    if (!abierto) return;
    function handler(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [abierto]);

  function elegir(emoji: string) {
    setReaccion(emoji);
    setAbierto(false);
    onReact?.(message.id, emoji);
  }

  return (
    <div
      className={cn(
        "flex flex-col",
        esStaff ? "items-end" : "items-start",
        isNew && "ccg-pop",
      )}
    >
      {/* Burbuja con picker de emojis */}
      <div className="group/bubble relative max-w-[78%]">
        <div
          className={cn(
            "rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
            esStaff
              ? "rounded-br-sm bg-brand text-white"
              : "rounded-bl-sm bg-card text-[var(--text)] ring-1 ring-line",
            // Deja espacio inferior si hay una reaccion activa.
            reaccion && !esStaff && "mb-3",
          )}
        >
          {esRespuestaAHistoria && (
            <div
              className={cn(
                "mb-1.5 flex items-center gap-2 border-l-2 pl-2",
                esStaff ? "border-white/40" : "border-brand/50",
              )}
            >
              {message.historiaUrl && historiaComo === "imagen" && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={message.historiaUrl}
                  alt="La historia que contestó"
                  onError={() => setHistoriaComo("video")}
                  className="h-10 w-7 shrink-0 rounded object-cover"
                />
              )}
              {message.historiaUrl && historiaComo === "video" && (
                <a href={message.historiaUrl} target="_blank" rel="noreferrer" className="shrink-0">
                  {/* Solo la portada: 9 MB de historia no se bajan enteros por
                      un cuadrito de 40 px. Se abre aparte para verla. */}
                  <video
                    src={message.historiaUrl}
                    muted
                    playsInline
                    preload="metadata"
                    onError={() => setHistoriaComo("nada")}
                    className="h-10 w-7 rounded bg-black object-cover"
                  />
                </a>
              )}
              <span className={cn("text-[11px]", esStaff ? "text-white/80" : "text-[var(--text-3)]")}>
                Respondió a tu historia
              </span>
            </div>
          )}
          {message.media ? (
            <>
              <MediaContenido media={message.media} />
              {/* El caption va DEBAJO del archivo, como en WhatsApp. Antes esto
                  era un o/o y el texto que venía con la foto se perdía. */}
              {caption && <p className="mt-1.5 whitespace-pre-wrap">{caption}</p>}
            </>
          ) : (
            textoLimpio
          )}
        </div>

        {/* Boton de reaccionar (solo mensajes del cliente) */}
        {!esStaff && onReact && (
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            aria-label="Reaccionar"
            className="absolute -right-8 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-card text-[var(--text-3)] opacity-0 shadow-sm transition hover:border-brand hover:text-brand group-hover/bubble:opacity-100"
          >
            <Smile size={13} />
          </button>
        )}

        {/* Picker de emojis */}
        {abierto && !esStaff && (
          <div
            ref={pickerRef}
            className="absolute left-0 top-full z-20 mt-1.5 flex gap-0.5 rounded-xl border border-line bg-card p-1.5 shadow-lg"
          >
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => elegir(e)}
                aria-label={`Reaccionar con ${e}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition hover:bg-surface"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Reaccion activa pegada a la burbuja */}
        {reaccion && !esStaff && (
          <span className="absolute -bottom-2.5 left-2 rounded-full border border-line bg-card px-1.5 py-0.5 text-[12px] leading-none shadow-sm">
            {reaccion}
          </span>
        )}
      </div>

      <span className="mt-1 px-1 text-[10.5px] text-[var(--text-3)]">
        {esStaff ? `${message.staffId ? nombreStaff(message.staffId) : "Asistente IA"} · ` : ""}
        {horaDe(message.ts)}
      </span>
    </div>
  );
}
