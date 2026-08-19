"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Download, Loader2, Pause, Play } from "lucide-react";
import { cn } from "@/lib/cn";

// Reproductor de notas de voz.
//
// El <audio controls> del navegador se veía y se portaba mal acá: cambia de
// aspecto en cada navegador, ocupa media burbuja y, mientras el proxy no
// mandaba Content-Length, ni siquiera sabía cuánto duraba la nota. Este es el
// mismo gesto de WhatsApp: un botón, una barra en la que se puede pinchar para
// adelantar, el tiempo, y velocidad para quien escucha veinte audios al día.
//
// Ojo con los formatos: WhatsApp manda OGG/Opus, que Chrome, Edge y Firefox
// reproducen sin problema. Safari es el que puede no poder; por eso, si el
// navegador avisa que no puede, en vez de dejar un control muerto se ofrece
// descargar el archivo.

const VELOCIDADES = [1, 1.5, 2];

function reloj(seg: number): string {
  if (!Number.isFinite(seg) || seg < 0) return "0:00";
  const m = Math.floor(seg / 60);
  const s = Math.floor(seg % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Barras de una onda de sonido. Son decorativas y a propósito SIEMPRE LAS
// MISMAS: dibujar la onda real obliga a bajar y decodificar el audio entero
// antes de mostrar nada, y no vale la pena para una nota de voz de un chat.
const ONDA = [
  8, 14, 20, 12, 26, 18, 30, 22, 16, 28, 12, 24, 18, 30, 14, 22, 10, 26, 20, 14,
  24, 16, 28, 12, 20, 26, 14, 18, 10, 16,
];

export function NotaDeVoz({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [sonando, setSonando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const [ahora, setAhora] = useState(0);
  const [total, setTotal] = useState(0);
  const [velocidad, setVelocidad] = useState(1);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const alTiempo = () => setAhora(a.currentTime);
    const alDurar = () => {
      // Un audio sin Content-Length llega con duración Infinity. No se pinta un
      // número inventado: se deja en cero y la barra queda quieta.
      setTotal(Number.isFinite(a.duration) ? a.duration : 0);
    };
    const alTerminar = () => {
      setSonando(false);
      setAhora(0);
      a.currentTime = 0;
    };
    a.addEventListener("timeupdate", alTiempo);
    a.addEventListener("loadedmetadata", alDurar);
    a.addEventListener("durationchange", alDurar);
    a.addEventListener("ended", alTerminar);
    a.addEventListener("error", () => {
      setError(true);
      setCargando(false);
      setSonando(false);
    });
    a.addEventListener("waiting", () => setCargando(true));
    a.addEventListener("playing", () => setCargando(false));
    return () => {
      a.removeEventListener("timeupdate", alTiempo);
      a.removeEventListener("loadedmetadata", alDurar);
      a.removeEventListener("durationchange", alDurar);
      a.removeEventListener("ended", alTerminar);
    };
  }, []);

  async function alternar() {
    const a = ref.current;
    if (!a) return;
    if (sonando) {
      a.pause();
      setSonando(false);
      return;
    }
    try {
      setCargando(true);
      await a.play();
      setSonando(true);
    } catch {
      setError(true);
    } finally {
      setCargando(false);
    }
  }

  function saltarA(e: React.MouseEvent<HTMLDivElement>) {
    const a = ref.current;
    if (!a || !total) return;
    const caja = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - caja.left) / caja.width));
    a.currentTime = pct * total;
    setAhora(a.currentTime);
  }

  function cambiarVelocidad() {
    const a = ref.current;
    const siguiente = VELOCIDADES[(VELOCIDADES.indexOf(velocidad) + 1) % VELOCIDADES.length];
    setVelocidad(siguiente);
    if (a) a.playbackRate = siguiente;
  }

  const avance = total > 0 ? ahora / total : 0;

  if (error) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2 text-[12.5px] font-semibold text-[var(--text-2)] transition hover:bg-surface"
      >
        <AlertCircle size={15} className="shrink-0 text-[var(--brand-accent)]" />
        Este navegador no reproduce la nota
        <Download size={14} className="ml-1 shrink-0" />
      </a>
    );
  }

  return (
    <div className="flex w-[260px] max-w-full items-center gap-2.5">
      <audio ref={ref} src={src} preload="metadata" className="hidden" />

      <button
        type="button"
        onClick={alternar}
        aria-label={sonando ? "Pausar nota de voz" : "Reproducir nota de voz"}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-sm shadow-brand/25 transition hover:brightness-110"
      >
        {cargando ? (
          <Loader2 size={16} className="animate-spin" />
        ) : sonando ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div
          onClick={saltarA}
          role="presentation"
          title="Pinchá para adelantar"
          className="flex h-7 cursor-pointer items-center gap-[2px]"
        >
          {ONDA.map((alto, i) => {
            const pintada = i / ONDA.length <= avance;
            return (
              <span
                key={i}
                // Los valores de ONDA van de 8 a 30; se estiran al rango 30-100%
                // para que la onda se vea como una onda y no como una línea de
                // puntos, que es lo que pasaba usándolos como porcentaje directo.
                style={{ height: `${Math.round(30 + (alto / 30) * 70)}%` }}
                className={cn(
                  "min-h-[4px] flex-1 rounded-full transition-colors",
                  pintada ? "bg-brand" : "bg-[var(--border-2)]",
                )}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between text-[11px] text-[var(--text-3)]">
          <span>{reloj(ahora)}</span>
          {total > 0 && <span>{reloj(total)}</span>}
        </div>
      </div>

      <button
        type="button"
        onClick={cambiarVelocidad}
        title="Velocidad"
        className="shrink-0 rounded-full border border-line bg-card px-2 py-1 text-[11px] font-bold text-[var(--text-2)] transition hover:bg-surface"
      >
        {velocidad}x
      </button>
    </div>
  );
}
