"use client";

// Comentarios de las publicaciones.
//
// Es la otra mitad de la bandeja. Los mensajes privados ya se atienden; acá se
// atiende lo público, que es donde se pierden más reservas: alguien pregunta el
// precio debajo de una foto, nadie contesta en dos días, y se fue.
//
// La pantalla abre en "sin responder" a propósito. Ver todos los comentarios
// ordenados por fecha no sirve para trabajar: lo que hay que ver es la cola.
//
// Cada comentario va con su hilo: las respuestas cuelgan debajo, con una línea
// a la izquierda, las de otras personas y las nuestras. Un reclamo suele venir
// como respuesta a otro comentario, y lo que ya contestó el hotel tiene que
// verse ahí mismo para no contestar dos veces.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  EyeOff,
  Eye,
  Heart,
  Instagram,
  Facebook,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { Comentario } from "@/lib/meta-comentarios";

type Filtro = "pendientes" | "todos" | "ocultos";

const ICONO = { facebook: Facebook, instagram: Instagram };
// Se vuelve a pedir cada dos minutos: los comentarios llegan mientras la
// pantalla está abierta, y antes había que recargar para verlos.
const CADA_MS = 2 * 60_000;

interface Hilo {
  c: Comentario;
  respuestas: Comentario[];
}

function haceCuanto(iso: string) {
  const min = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(min) || min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

/**
 * Los comentarios de primer nivel con sus respuestas colgadas, en el orden en
 * que vinieron (los más nuevos primero). Las respuestas van cronológicas: un
 * hilo se lee de arriba hacia abajo.
 */
function armarHilos(cs: Comentario[]): Hilo[] {
  const porPadre = new Map<string, Comentario[]>();
  for (const c of cs) {
    if (c.padreId) {
      const lista = porPadre.get(c.padreId) ?? [];
      lista.push(c);
      porPadre.set(c.padreId, lista);
    }
  }
  return cs
    .filter((c) => !c.padreId)
    .map((c) => ({
      c,
      respuestas: (porPadre.get(c.id) ?? []).slice().sort((a, b) => (a.ts < b.ts ? -1 : 1)),
    }));
}

export default function ComentariosPage() {
  const [datos, setDatos] = useState<{ comentarios: Comentario[]; sinConexion?: boolean } | null>(null);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("pendientes");
  const [abierto, setAbierto] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/meta/comentarios", { cache: "no-store" });
      const j = await r.json();
      if (j.ok !== false) setDatos({ comentarios: j.comentarios ?? [], sinConexion: j.sinConexion });
    } catch {
      // Se queda con lo que ya tenía; el próximo tick vuelve a intentar.
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    void cargar();
    const t = window.setInterval(() => void cargar(), CADA_MS);
    return () => window.clearInterval(t);
  }, [cargar]);

  const hilos = useMemo(() => armarHilos(datos?.comentarios ?? []), [datos]);
  const pendientes = useMemo(() => hilos.filter((h) => !h.c.respondido && !h.c.oculto), [hilos]);
  const visibles = useMemo(() => {
    if (filtro === "ocultos") return hilos.filter((h) => h.c.oculto);
    if (filtro === "todos") return hilos.filter((h) => !h.c.oculto);
    return pendientes;
  }, [hilos, pendientes, filtro]);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-card px-5 py-3">
        <div className="mr-auto">
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Comentarios</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            Lo que preguntan en público, debajo de tus publicaciones
          </p>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-[13px] font-semibold text-[var(--text-2)] disabled:opacity-60"
        >
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          Actualizar
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {datos?.sinConexion ? (
          <div className="rounded-2xl border border-dashed border-[var(--border-2)] bg-card p-8 text-center">
            <MessageSquare size={26} className="mx-auto text-[var(--text-3)]" />
            <p className="mt-2 text-[13.5px] font-semibold text-[var(--text-1)]">
              Todavía no hay redes conectadas
            </p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-[var(--text-3)]">
              Cuando conectes las páginas de Facebook e Instagram, los comentarios de tus
              publicaciones van a caer acá para responderlos sin salir del panel.
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Pestana activo={filtro === "pendientes"} onClick={() => setFiltro("pendientes")}>
                Sin responder{pendientes.length ? ` · ${pendientes.length}` : ""}
              </Pestana>
              <Pestana activo={filtro === "todos"} onClick={() => setFiltro("todos")}>
                Todos
              </Pestana>
              <Pestana activo={filtro === "ocultos"} onClick={() => setFiltro("ocultos")}>
                Ocultos
              </Pestana>
            </div>

            {cargando && !datos ? (
              <p className="flex items-center gap-2 py-8 text-[13px] text-[var(--text-3)]">
                <Loader2 size={15} className="animate-spin" />
                Trayendo comentarios de Facebook e Instagram
              </p>
            ) : visibles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border-2)] bg-card p-8 text-center">
                <MessageSquare size={26} className="mx-auto text-[var(--text-3)]" />
                <p className="mt-2 text-[13px] text-[var(--text-2)]">
                  {filtro === "pendientes"
                    ? "No queda ningún comentario sin responder."
                    : "Nada por acá."}
                </p>
              </div>
            ) : (
              // Agrupados por publicacion. Una lista plana no dice a que se
              // esta contestando: dos comentarios seguidos pueden ser de dos
              // publicaciones distintas y la respuesta cambia por completo.
              <div className="space-y-4">
                {agrupar(visibles).map((g) => (
                  <section key={g.postId} className="overflow-hidden rounded-2xl border border-line bg-card">
                    <div className="flex items-start gap-3 border-b border-line bg-surface/40 px-4 py-3">
                      {g.imagen && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={g.imagen} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] leading-relaxed text-[var(--text-1)]">
                          {g.resumen || "Publicación sin texto"}
                        </p>
                        <p className="mt-1 text-[11.5px] text-[var(--text-3)]">
                          {g.hilos.length} {g.hilos.length === 1 ? "comentario" : "comentarios"}
                          {g.enlace && (
                            <>
                              {" · "}
                              <a
                                href={g.enlace}
                                target="_blank"
                                rel="noreferrer"
                                className="font-semibold text-brand underline underline-offset-2"
                              >
                                Ver publicación
                              </a>
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <ul className="divide-y divide-[var(--line)]">
                      {g.hilos.map((h) => (
                        <li key={h.c.id}>
                          <Fila
                            c={h.c}
                            abierto={abierto === h.c.id}
                            onToggle={() => setAbierto(abierto === h.c.id ? null : h.c.id)}
                            onHecho={cargar}
                          />
                          {h.respuestas.length > 0 && (
                            // El hilo: las respuestas cuelgan del comentario con
                            // una línea a la izquierda. Se ven siempre, no solo
                            // al abrir: un reclamo puede estar en la respuesta.
                            <ul className="ml-10 mr-4 mb-3 space-y-1.5 border-l-2 border-line pl-3">
                              {h.respuestas.map((r) => (
                                <li key={r.id}>
                                  <Respuesta r={r} onHecho={cargar} />
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Pestana({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12.5px] transition",
        activo
          ? "border-brand bg-brand text-white"
          : "border-line bg-card text-[var(--text-2)] hover:border-[var(--border-2)]",
      )}
    >
      {children}
    </button>
  );
}

/** Manda una acción sobre un comentario y devuelve el error de Meta, si lo hubo. */
async function accionar(c: Comentario, cuerpo: Record<string, unknown>): Promise<string | null> {
  const r = await fetch("/api/meta/comentarios", {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Responder a una respuesta va contra el comentario de arriba: ni
    // Facebook ni Instagram dejan colgar una respuesta de otra respuesta.
    // Ocultar, me gusta y el privado sí van contra la respuesta misma.
    body: JSON.stringify({
      id: cuerpo.texto && !cuerpo.privado ? (c.padreId ?? c.id) : c.id,
      pageId: c.pageId,
      ...cuerpo,
    }),
  });
  const j = await r.json().catch(() => ({ ok: false }));
  return j.ok ? null : (j.error ?? "No se pudo.");
}

/** Corazón de la página. Solo Facebook: Instagram no lo da por API. */
function MeGusta({ c, onHecho }: { c: Comentario; onHecho: () => Promise<void> }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!c.puedeMeGusta || c.nuestro) return null;
  return (
    <>
      <button
        type="button"
        disabled={enviando}
        onClick={async (e) => {
          e.stopPropagation();
          setEnviando(true);
          setError(await accionar(c, { meGusta: !c.meGustaNuestro }));
          setEnviando(false);
          await onHecho();
        }}
        title={c.meGustaNuestro ? "Quitar el me gusta de la página" : "Me gusta, como la página"}
        className={cn(
          "inline-flex items-center gap-1 text-[12px] font-semibold disabled:opacity-50",
          c.meGustaNuestro ? "text-[#e0245e]" : "text-[var(--text-2)]",
        )}
      >
        <Heart size={13} fill={c.meGustaNuestro ? "currentColor" : "none"} />
        {c.meGustaNuestro ? "Te gusta" : "Me gusta"}
      </button>
      {error && <span className="text-[11.5px] text-[var(--bad-fg,#991b1b)]">{error}</span>}
    </>
  );
}

/** Una respuesta dentro del hilo: de otra persona o nuestra. */
function Respuesta({ r, onHecho }: { r: Comentario; onHecho: () => Promise<void> }) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2",
        r.nuestro ? "bg-brand/10 ring-1 ring-brand/20" : "bg-surface/60",
        r.oculto && "opacity-60",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className={cn("text-[12.5px] font-semibold", r.nuestro ? "text-brand" : "text-[var(--text-1)]")}>
          {r.nuestro ? `${r.autor} (nosotros)` : r.autor}
        </span>
        <span className="text-[11px] text-[var(--text-3)]">{haceCuanto(r.ts)}</span>
        {r.oculto && (
          <span className="rounded-full bg-[var(--bg-2,#f1f5f9)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
            Oculto
          </span>
        )}
      </div>
      <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-[var(--text-2)]">{r.texto}</p>
      {!r.nuestro && (
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <MeGusta c={r} onHecho={onHecho} />
          <button
            type="button"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              setError(await accionar(r, { ocultar: !r.oculto }));
              setEnviando(false);
              await onHecho();
            }}
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--text-2)] disabled:opacity-50"
          >
            {r.oculto ? <Eye size={12} /> : <EyeOff size={12} />}
            {r.oculto ? "Mostrar" : "Ocultar"}
          </button>
          {r.meGusta > 0 && <span className="text-[11px] text-[var(--text-3)]">{r.meGusta} me gusta</span>}
          {error && <span className="text-[11.5px] text-[var(--bad-fg,#991b1b)]">{error}</span>}
        </div>
      )}
    </div>
  );
}

function Fila({
  c,
  abierto,
  onToggle,
  onHecho,
}: {
  c: Comentario;
  abierto: boolean;
  onToggle: () => void;
  onHecho: () => Promise<void>;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icono = ICONO[c.red];

  async function mandar(cuerpo: Record<string, unknown>) {
    setEnviando(true);
    setError(null);
    const e = await accionar(c, cuerpo);
    setEnviando(false);
    if (e) {
      setError(e);
      return;
    }
    setTexto("");
    await onHecho();
  }

  return (
    <div className={cn("bg-card", c.oculto && "opacity-70")}>
      <button type="button" onClick={onToggle} className="flex w-full items-start gap-3 px-4 py-3 text-left">
        <span className="mt-0.5 shrink-0 text-[var(--text-3)]">
          <Icono size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-[13.5px] font-semibold text-[var(--text-1)]">{c.autor}</span>
            <span className="text-[11.5px] text-[var(--text-3)]">{haceCuanto(c.ts)}</span>
            {c.respondido && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#2f9e2f]">
                Respondido
              </span>
            )}
            {c.enlace && (
              // Sin App Review, Facebook no dice quién comentó. Abrirlo allá sí
              // lo muestra; el enlace va al comentario, no a la publicación.
              <a
                href={c.enlace}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11.5px] font-semibold text-brand hover:underline"
              >
                Ver en Facebook
              </a>
            )}
            {c.oculto && (
              <span className="rounded-full bg-[var(--bg-2,#f1f5f9)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                Oculto
              </span>
            )}
          </span>
          <span className="mt-0.5 block whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-2)]">{c.texto}</span>
        </span>
      </button>

      {abierto && (
        <div className="space-y-2.5 border-t border-line px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (texto.trim()) void mandar({ texto });
            }}
            className="flex gap-2"
          >
            <input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={`Responderle a ${c.autor}`}
              className="flex-1 rounded-lg border border-line bg-card px-3 py-2 text-[12.5px]"
            />
            <button
              type="submit"
              disabled={enviando || !texto.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
            >
              {enviando ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              Responder
            </button>
            {(c.red === "instagram" || c.privadoPosible) && (
              <button
                type="button"
                onClick={() => {
                  if (texto.trim()) void mandar({ texto, privado: true });
                }}
                disabled={enviando || !texto.trim()}
                title="Le llega como mensaje privado, no debajo del comentario. Una sola vez por comentario."
                className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-2 text-[12.5px] font-semibold text-[var(--text-1)] disabled:opacity-50"
              >
                <Send size={13} />
                En privado
              </button>
            )}
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <MeGusta c={c} onHecho={onHecho} />
            <button
              type="button"
              onClick={() => void mandar({ ocultar: !c.oculto })}
              disabled={enviando}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-2)] disabled:opacity-50"
            >
              {c.oculto ? <Eye size={13} /> : <EyeOff size={13} />}
              {c.oculto ? "Volver a mostrar" : "Ocultar"}
            </button>
            <span className="text-[11.5px] text-[var(--text-3)]">
              {c.respuestas === 0
                ? "sin respuestas"
                : `${c.respuestas} respuesta${c.respuestas > 1 ? "s" : ""}${c.respondido ? "" : ", ninguna nuestra"}`}
              {c.meGusta > 0 && ` · ${c.meGusta} me gusta`}
            </span>
          </div>

          {/* Ocultar y no borrar es a propósito: quien lo escribió lo sigue
              viendo, así que no se da cuenta y no arma pleito. */}
          <p className="text-[11px] leading-relaxed text-[var(--text-3)]">
            Al ocultar, el comentario deja de verse para el público pero quien lo escribió lo sigue
            viendo. No se borra.
          </p>

          {error && <p className="text-[12px] text-[var(--bad-fg,#991b1b)]">{error}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * Los hilos, juntos por publicacion.
 *
 * Se conserva el orden en que vinieron: la publicacion con el comentario mas
 * nuevo queda arriba, que es la que hay que mirar primero.
 */
function agrupar(hs: Hilo[]) {
  const orden: string[] = [];
  const mapa = new Map<string, { postId: string; resumen?: string; imagen?: string; enlace?: string; hilos: Hilo[] }>();
  for (const h of hs) {
    const k = h.c.postId || "sin-publicacion";
    if (!mapa.has(k)) {
      orden.push(k);
      mapa.set(k, { postId: k, resumen: h.c.postResumen, imagen: h.c.postImagen, enlace: h.c.postEnlace, hilos: [] });
    }
    mapa.get(k)!.hilos.push(h);
  }
  return orden.map((k) => mapa.get(k)!);
}
