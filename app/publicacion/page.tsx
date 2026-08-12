/* eslint-disable @next/next/no-img-element */
"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  Copy,
  Download,
  ImageIcon,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";
import { dibujarPieza } from "@/lib/inmobiliaria-lienzo";
import {
  AMBIENTE_NOMBRE,
  FORMATOS,
  TIPO_NOMBRE,
  nombreEstado,
  type Anuncio,
  type Foto,
  type FormatoRed,
  type Propiedad,
} from "@/lib/inmobiliaria-tipos";

const MARCA = "Terrazul Bienes Raíces";

export default function PublicacionPage() {
  return (
    <Suspense fallback={<div className="flex-1 bg-surface" />}>
      <Publicacion />
    </Suspense>
  );
}

function Publicacion() {
  const router = useRouter();
  const search = useSearchParams();
  const esInmobiliaria = activeTenantId() === "inmobiliaria";
  useEffect(() => {
    if (!esInmobiliaria) router.replace("/");
  }, [esInmobiliaria, router]);

  const [lista, setLista] = useState<Propiedad[]>([]);
  const [id, setId] = useState<string>("");
  const [p, setP] = useState<Propiedad | null>(null);
  const [anuncio, setAnuncio] = useState<Anuncio | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [formato, setFormato] = useState<FormatoRed>(FORMATOS[0]);
  const [orden, setOrden] = useState<Foto[]>([]);
  const [fuera, setFuera] = useState<string[]>([]);
  const [slide, setSlide] = useState(0);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [bajando, setBajando] = useState(false);

  const lienzo = useRef<HTMLCanvasElement | null>(null);

  // Catálogo para el selector.
  useEffect(() => {
    if (!esInmobiliaria) return;
    fetch("/api/inmobiliaria/cartera", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) return;
        setLista(d.cartera.propiedades);
        const pedido = search.get("id");
        const inicial =
          (pedido && d.cartera.propiedades.some((x: Propiedad) => x.id === pedido) && pedido) ||
          d.cartera.propiedades.find((x: Propiedad) => x.estado === "disponible")?.id ||
          d.cartera.propiedades[0]?.id;
        if (inicial) setId(inicial);
      })
      .catch(() => setError("No se pudo leer la cartera."));
  }, [esInmobiliaria, search]);

  // Anuncio de la propiedad elegida.
  useEffect(() => {
    if (!id) return;
    fetch(`/api/inmobiliaria/publicacion?id=${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!d.ok) {
          setError(d.error ?? "No se pudo armar el anuncio.");
          return;
        }
        setError(null);
        setP(d.propiedad);
        setAnuncio(d.anuncio);
        setTitulo(d.anuncio.titulo);
        setDescripcion(d.anuncio.descripcion);
        setOrden(d.anuncio.carrusel);
        setFuera([]);
        setSlide(0);
      })
      .catch(() => setError("No se pudo armar el anuncio."));
  }, [id]);

  const incluidas = orden.filter((f) => !fuera.includes(f.src));

  // ── Composición sobre la foto REAL de la ficha ──
  // El dibujo vive en lib/inmobiliaria-lienzo: el alta desde el teléfono publica
  // con exactamente el mismo arte, sin pasar por esta pantalla.
  const dibujar = useCallback(
    async (canvas: HTMLCanvasElement, indice: number): Promise<void> => {
      if (!anuncio || !p) return;
      const foto = incluidas[indice];
      if (!foto) return;
      await dibujarPieza({ canvas, anuncio, marca: MARCA, formato, foto, portada: indice === 0 });
    },
    [anuncio, p, formato, incluidas],
  );

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) return;
    let vivo = true;
    dibujar(canvas, slide).then(() => {
      if (!vivo) return;
    });
    return () => {
      vivo = false;
    };
  }, [dibujar, slide]);

  async function descargar(indice: number) {
    if (!p) return;
    const canvas = document.createElement("canvas");
    await dibujar(canvas, indice);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${p.codigo}-${formato.id}-${indice === 0 ? "portada" : indice + 1}.png`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function descargarTodo() {
    setBajando(true);
    for (let i = 0; i < incluidas.length; i++) {
      await descargar(i);
      await new Promise((r) => setTimeout(r, 350));
    }
    setBajando(false);
  }

  async function copiarImagen() {
    const canvas = document.createElement("canvas");
    await dibujar(canvas, slide);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      avisar("imagen");
    } catch {
      setError("El navegador no dejó copiar la imagen. Usa el botón de descargar.");
    }
  }

  function avisar(que: string) {
    setCopiado(que);
    setTimeout(() => setCopiado(null), 1800);
  }

  async function copiar(texto: string, que: string) {
    try {
      await navigator.clipboard.writeText(texto);
      avisar(que);
    } catch {
      setError("El navegador no dejó copiar el texto.");
    }
  }

  function mover(i: number, delta: number) {
    const siguiente = [...orden];
    const j = i + delta;
    if (j < 0 || j >= siguiente.length) return;
    [siguiente[i], siguiente[j]] = [siguiente[j], siguiente[i]];
    setOrden(siguiente);
    setSlide(0);
  }

  if (!esInmobiliaria) return <div className="flex-1 bg-surface" />;

  const bloqueada = Boolean(anuncio?.bloqueo);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Publicación</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            Texto y arte listos con la ficha y las fotos de la propiedad
          </p>
        </div>
        <select
          value={id}
          onChange={(e) => setId(e.target.value)}
          className="rounded-xl border border-line bg-card px-3 py-2 text-[13px] font-semibold text-[var(--text)] outline-none transition focus:border-brand"
        >
          {lista.map((x) => (
            <option key={x.id} value={x.id}>
              {x.codigo} · {TIPO_NOMBRE[x.tipo]} en {x.zona}
              {x.estado !== "disponible" ? ` (${nombreEstado(x.estado, x.operacion).toLowerCase()})` : ""}
            </option>
          ))}
        </select>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {error && (
          <p className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[var(--brand-red)]/40 bg-[var(--brand-red)]/10 px-4 py-3 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {anuncio?.bloqueo && p && (
          <div className="mb-4 rounded-2xl border border-[var(--brand-red)]/50 bg-[var(--brand-red)]/[0.08] px-4 py-3">
            <p className="flex items-start gap-2 text-[13px] font-bold text-[var(--brand-red)]">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {anuncio.bloqueo}
            </p>
            <p className="mt-1 text-[12.5px] text-[var(--text-2)]">
              Cambia el estado en la ficha si se cayó la venta, o elige otra propiedad.{" "}
              <Link
                href={`/cartera/${p.id}`}
                className="font-semibold text-[var(--brand-red)] underline underline-offset-2"
              >
                Abrir {p.codigo}
              </Link>
            </p>
          </div>
        )}

        {anuncio?.advertencia && (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/[0.08] px-3.5 py-2.5 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
            {anuncio.advertencia}
          </p>
        )}

        {anuncio && p && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* ── Texto ── */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-line bg-card p-5">
                <Encabezado
                  titulo="Texto del anuncio"
                  accion={
                    <Boton
                      onClick={() => copiar(`${titulo}\n\n${descripcion}\n\n${anuncio.hashtags.join(" ")}`, "texto")}
                      activo={copiado === "texto"}
                    >
                      Copiar
                    </Boton>
                  }
                />
                <label className="mt-3 block">
                  <span className="text-[11.5px] font-semibold text-[var(--text-2)]">Título</span>
                  <input
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-[var(--text)] outline-none transition focus:border-brand focus:bg-card"
                  />
                </label>
                <label className="mt-3 block">
                  <span className="text-[11.5px] font-semibold text-[var(--text-2)]">Descripción</span>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={12}
                    className="mt-1 w-full resize-y rounded-xl border border-line bg-surface px-3 py-2 text-[13px] leading-relaxed text-[var(--text)] outline-none transition focus:border-brand focus:bg-card"
                  />
                </label>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {anuncio.hashtags.map((h) => (
                    <span
                      key={h}
                      className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] font-semibold text-[var(--text-2)]"
                    >
                      {h}
                    </span>
                  ))}
                </p>
              </section>

              <section className="rounded-2xl border border-line bg-card p-5">
                <Encabezado
                  titulo="Para Encuentra24"
                  accion={
                    <Boton onClick={() => copiar(anuncio.encuentra24, "portal")} activo={copiado === "portal"}>
                      Copiar
                    </Boton>
                  }
                />
                <p className="mt-1 text-[11.5px] leading-snug text-[var(--text-3)]">
                  Los campos van en el orden del formulario del portal. Se pega a mano: no hay
                  conexión automática con Encuentra24.
                </p>
                <pre className="mt-3 max-h-64 overflow-auto rounded-xl border border-line bg-surface p-3 text-[12px] leading-relaxed text-[var(--text-2)] whitespace-pre-wrap">
                  {anuncio.encuentra24}
                </pre>
              </section>
            </div>

            {/* ── Imágenes ── */}
            <div className="space-y-4">
              <section className="rounded-2xl border border-line bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-bold text-[var(--text)]">Portada y carrusel</h2>
                  <div className="inline-flex rounded-xl border border-line bg-card p-0.5">
                    {FORMATOS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFormato(f)}
                        className={cn(
                          "rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition",
                          formato.id === f.id
                            ? "bg-brand text-white shadow-sm shadow-brand/25"
                            : "text-[var(--text-2)] hover:bg-surface",
                        )}
                      >
                        {f.nombre} {f.ancho}x{f.alto}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row">
                  <canvas
                    ref={lienzo}
                    className="w-full max-w-[300px] self-start rounded-xl border border-line shadow-sm"
                    style={{ aspectRatio: `${formato.ancho} / ${formato.alto}` }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <p className="text-[12.5px] leading-relaxed text-[var(--text-2)]">
                      {anuncio.ordenExplicado}
                    </p>
                    <p className="text-[11.5px] leading-relaxed text-[var(--text-3)]">
                      El precio, la zona y los datos se estampan encima de la foto de la ficha. Nada
                      de la imagen se inventa.
                    </p>
                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => descargar(slide)}
                        disabled={bloqueada}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-[12.5px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110 disabled:opacity-50"
                      >
                        <Download size={14} />
                        Descargar
                      </button>
                      <button
                        type="button"
                        onClick={copiarImagen}
                        disabled={bloqueada}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-[12.5px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-50"
                      >
                        {copiado === "imagen" ? <Check size={14} /> : <Copy size={14} />}
                        Copiar imagen
                      </button>
                      <button
                        type="button"
                        onClick={descargarTodo}
                        disabled={bloqueada || bajando}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-[12.5px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-50"
                      >
                        {bajando ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
                        Carrusel completo ({incluidas.length})
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-line bg-card p-5">
                <h2 className="text-sm font-bold text-[var(--text)]">Orden de las fotos</h2>
                <ul className="mt-3 space-y-2">
                  {orden.map((f, i) => {
                    const dentro = !fuera.includes(f.src);
                    const posicion = incluidas.findIndex((x) => x.src === f.src);
                    return (
                      <li
                        key={f.src}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border p-2 transition",
                          dentro ? "border-line bg-surface/60" : "border-dashed border-[var(--border-2)] opacity-60",
                          dentro && posicion === slide && "ring-1 ring-brand",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => dentro && setSlide(posicion)}
                          className="h-12 w-16 shrink-0 overflow-hidden rounded-lg"
                          aria-label={`Ver ${AMBIENTE_NOMBRE[f.ambiente]}`}
                        >
                          <img src={f.src} alt="" className="h-full w-full object-cover" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-bold text-[var(--text)]">
                            {AMBIENTE_NOMBRE[f.ambiente]}
                          </p>
                          <p className="text-[11.5px] text-[var(--text-3)]">
                            {dentro
                              ? posicion === 0
                                ? "Abre el carrusel y lleva la portada"
                                : `Va en la posición ${posicion + 1}`
                              : "Fuera del carrusel"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <IconoBoton onClick={() => mover(i, -1)} label="Subir">
                            <ArrowUp size={14} />
                          </IconoBoton>
                          <IconoBoton onClick={() => mover(i, 1)} label="Bajar">
                            <ArrowDown size={14} />
                          </IconoBoton>
                          <button
                            type="button"
                            onClick={() => {
                              setFuera(dentro ? [...fuera, f.src] : fuera.filter((s) => s !== f.src));
                              setSlide(0);
                            }}
                            className={cn(
                              "rounded-lg border px-2 py-1 text-[11.5px] font-semibold transition",
                              dentro
                                ? "border-line text-[var(--text-3)] hover:text-[var(--text-2)]"
                                : "border-brand text-brand",
                            )}
                          >
                            {dentro ? "Quitar" : "Sumar"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Encabezado({ titulo, accion }: { titulo: string; accion: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold text-[var(--text)]">{titulo}</h2>
      {accion}
    </div>
  );
}

function Boton({
  onClick,
  activo,
  children,
}: {
  onClick: () => void;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface"
    >
      {activo ? <Check size={13} className="text-[var(--brand-green)]" /> : <Copy size={13} />}
      {activo ? "Copiado" : children}
    </button>
  );
}

function IconoBoton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-line text-[var(--text-3)] transition hover:bg-card hover:text-[var(--text-2)]"
    >
      {children}
    </button>
  );
}

