"use client";

// Probar a Sofía: un chat contra el guion real, con reset.
//
// Quien prueba hace de huésped. Cada turno pasa por /api/yali/sofia, que corre
// lo mismo que un mensaje de verdad (sede, tope, herramientas, traspasos). El
// historial vive en el navegador (localStorage) para poder seguir mañana, y
// "Reiniciar" lo borra y cierra el apartado que haya quedado vivo.

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, ImagePlus, Loader2, RotateCcw, Send, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { ApartadoCard, type Apartado } from "@/components/yali/Apartados";

interface Mensaje {
  autor: "cliente" | "staff";
  texto: string;
  sucursal?: boolean;
  /** Nota del sistema para quien prueba (no forma parte del historial). */
  nota?: string;
  uso?: { llamadas: number; entrada: number; salida: number; modelo: string };
  reacciones?: string[];
}

interface Estado {
  sesionId: string;
  mensajes: Mensaje[];
  sucursalId: string | null;
  intentos: number;
  traspaso: { para: string; motivo: string; area?: string } | null;
  limite: number;
}

const LLAVE = "yali.sofia.prueba";
const NOMBRE_STAFF: Record<string, string> = { s2: "Verónica", s3: "Olga" };
const MOTIVO: Record<string, string> = {
  pago: "llegó el comprobante",
  socio: "es socio o quiere serlo",
  reclamo: "reclamo",
  audio: "nota de voz",
  limite: "se llegó al tope de mensajes",
  sede: "no se pudo saber la sede",
  otro: "algo que no puede cerrar sola",
};

function nuevoEstado(): Estado {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : String(Date.now());
  return { sesionId: id, mensajes: [], sucursalId: null, intentos: 0, traspaso: null, limite: 10 };
}

export default function SofiaPruebaPage() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apartado, setApartado] = useState<Apartado | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(LLAVE);
      setEstado(guardado ? (JSON.parse(guardado) as Estado) : nuevoEstado());
    } catch {
      setEstado(nuevoEstado());
    }
  }, []);

  useEffect(() => {
    if (!estado) return;
    try {
      localStorage.setItem(LLAVE, JSON.stringify(estado));
    } catch {}
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [estado]);

  const cargarApartado = useCallback(async () => {
    if (!estado) return;
    try {
      const r = await fetch(`/api/yali/prereservas?clave=${encodeURIComponent(`prueba:${estado.sesionId}`)}`, { cache: "no-store" });
      const d = (await r.json()) as { ok?: boolean; reservas?: Apartado[] };
      setApartado(d.ok && d.reservas && d.reservas.length ? d.reservas[0] : null);
    } catch {}
  }, [estado?.sesionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void cargarApartado();
  }, [cargarApartado]);

  async function turno(cuerpo: { texto?: string; comprobante?: boolean }) {
    if (!estado || cargando) return;
    setCargando(true);
    setError(null);
    const historial = estado.mensajes.filter((m) => !m.nota).map(({ autor, texto, sucursal }) => ({ autor, texto, sucursal }));
    const mensajesConCliente: Mensaje[] = cuerpo.texto
      ? [...estado.mensajes, { autor: "cliente", texto: cuerpo.texto }]
      : [...estado.mensajes, { autor: "cliente", texto: "[imagen] (comprobante de prueba)" }];
    setEstado({ ...estado, mensajes: mensajesConCliente });
    try {
      const r = await fetch("/api/yali/sofia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sesionId: estado.sesionId,
          texto: cuerpo.texto,
          comprobante: cuerpo.comprobante,
          historial,
          sucursalId: estado.sucursalId,
          intentos: estado.intentos,
        }),
      });
      const d = (await r.json()) as {
        ok: boolean;
        error?: string;
        tipo?: string;
        respuesta?: string;
        sucursalMsg?: boolean;
        aviso?: string;
        traspaso?: { para: string; motivo: string; area?: string } | null;
        uso?: Mensaje["uso"];
        reacciones?: string[];
        sucursalId?: string | null;
        intentos?: number;
        limite?: number;
        apartado?: Apartado | null;
      };
      if (!d.ok) {
        setError(d.error ?? "Falló el turno.");
        setEstado({ ...estado, mensajes: mensajesConCliente });
        return;
      }
      const nuevos: Mensaje[] = [...mensajesConCliente];
      if (d.respuesta) nuevos.push({ autor: "staff", texto: d.respuesta, sucursal: d.sucursalMsg, uso: d.uso, reacciones: d.reacciones });
      if (d.aviso) nuevos.push({ autor: "staff", texto: "", nota: d.aviso });
      if (d.traspaso) {
        const quien = NOMBRE_STAFF[d.traspaso.para] ?? d.traspaso.para;
        nuevos.push({ autor: "staff", texto: "", nota: `Sofía pasó el chat a ${quien} (${MOTIVO[d.traspaso.motivo] ?? d.traspaso.motivo}) y dejó de responder aquí.` });
      }
      setEstado({
        ...estado,
        mensajes: nuevos,
        sucursalId: d.sucursalId ?? estado.sucursalId,
        intentos: d.intentos ?? estado.intentos,
        traspaso: d.traspaso ?? estado.traspaso,
        limite: d.limite ?? estado.limite,
      });
      setApartado(d.apartado ?? null);
    } catch {
      setError("No se pudo hablar con Sofía.");
    } finally {
      setCargando(false);
      inputRef.current?.focus();
    }
  }

  async function reiniciar() {
    if (!estado) return;
    if (estado.mensajes.length && !window.confirm("¿Borrar esta conversación de prueba y empezar de cero?")) return;
    try {
      await fetch("/api/yali/sofia", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sesionId: estado.sesionId }) });
    } catch {}
    setApartado(null);
    setError(null);
    setTexto("");
    setEstado(nuevoEstado());
  }

  function enviar() {
    const t = texto.trim();
    if (!t) return;
    setTexto("");
    void turno({ texto: t });
  }

  if (!estado) return <div className="h-full bg-surface" />;
  const usados = estado.mensajes.filter((m) => m.autor === "staff" && !m.nota).length;
  const apagada = estado.traspaso !== null || usados >= estado.limite;
  const apartadoVivo = apartado && (apartado.estado === "pendiente_pago" || apartado.estado === "comprobante_recibido");

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Probar a Sofía</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            Escribís como si fueras un huésped. Mismo guion, mismas herramientas y mismas reglas que en Messenger, Instagram y WhatsApp.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-[12px] font-semibold",
              apagada ? "border-line bg-surface text-[var(--text-3)]" : "border-brand/30 bg-brand/[0.07] text-brand",
            )}
          >
            {usados} de {estado.limite} mensajes de Sofía
          </span>
          <button
            type="button"
            onClick={() => void turno({ comprobante: true })}
            disabled={cargando || !apartadoVivo || apartado?.estado === "comprobante_recibido"}
            title={apartadoVivo ? "Simula que el huésped manda la captura del pago" : "Se habilita cuando Sofía deja una habitación apartada"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-3 py-1.5 text-[12.5px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-50"
          >
            <ImagePlus size={14} /> Simular comprobante
          </button>
          <button
            type="button"
            onClick={() => void reiniciar()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12.5px] font-semibold text-white transition hover:opacity-90"
          >
            <RotateCcw size={14} /> Reiniciar
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-5 p-5">
        {/* El chat */}
        <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-line bg-card shadow-sm">
          <div className="flex-1 space-y-3 overflow-y-auto p-5">
            {estado.mensajes.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center text-[var(--text-3)]">
                <Bot size={28} className="mb-2 text-brand" />
                <p className="text-[14px] font-semibold text-[var(--text)]">Escribí "Hola" para empezar</p>
                <p className="mt-1 max-w-sm text-[12.5px]">
                  Sofía va a preguntar a cuál hotel escribís, cotizar con las tarifas reales, apartar la habitación y pedir el comprobante.
                </p>
              </div>
            )}
            {estado.mensajes.map((m, i) =>
              m.nota ? (
                <p key={i} className="mx-auto max-w-lg rounded-xl border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/10 px-3.5 py-2 text-center text-[12px] text-[var(--text-2)]">
                  {m.nota}
                </p>
              ) : (
                <div key={i} className={cn("flex items-end gap-2", m.autor === "cliente" ? "justify-end" : "justify-start")}>
                  {m.autor === "staff" && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                      <Bot size={14} />
                    </span>
                  )}
                  <div className={cn("max-w-[70%]", m.autor === "cliente" ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-[13.5px] leading-relaxed shadow-sm",
                        m.autor === "cliente" ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-surface text-[var(--text)] ring-1 ring-line",
                      )}
                    >
                      {m.texto}
                    </div>
                    <p className={cn("mt-0.5 text-[10.5px] text-[var(--text-3)]", m.autor === "cliente" ? "text-right" : "")}>
                      {m.autor === "cliente"
                        ? "Vos (huésped)"
                        : m.sucursal
                          ? "Sofía · pregunta fija de sede, sin modelo"
                          : `Sofía (IA)${m.uso ? ` · ${m.uso.llamadas} ${m.uso.llamadas === 1 ? "llamada" : "llamadas"} · ${m.uso.entrada + m.uso.salida} tokens` : ""}`}
                      {m.reacciones?.length ? ` · reaccionó ${m.reacciones.join(" ")}` : ""}
                    </p>
                  </div>
                  {m.autor === "cliente" && (
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-[var(--text-3)] ring-1 ring-line">
                      <UserRound size={14} />
                    </span>
                  )}
                </div>
              ),
            )}
            {cargando && (
              <div className="flex items-center gap-2 text-[12px] text-[var(--text-3)]">
                <Loader2 size={13} className="animate-spin text-brand" /> Sofía está escribiendo
              </div>
            )}
            <div ref={finRef} />
          </div>
          {error && <p className="border-t border-line px-5 py-2 text-[12.5px] text-[#c2410c]">{error}</p>}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar();
            }}
            className="flex items-center gap-2 border-t border-line p-3"
          >
            <input
              ref={inputRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              disabled={cargando || apagada}
              placeholder={apagada ? "Sofía ya no responde en este chat. Reiniciá para empezar otro." : "Escribí como huésped..."}
              className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13.5px] text-[var(--text)] outline-none focus:border-brand focus:ring-2 focus:ring-brand/15 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={cargando || apagada || !texto.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white transition hover:opacity-90 disabled:opacity-40"
              aria-label="Enviar"
            >
              <Send size={16} />
            </button>
          </form>
        </section>

        {/* Lo que pasa por detrás */}
        <aside className="hidden w-80 shrink-0 space-y-4 xl:block">
          <div className="rounded-2xl border border-line bg-card p-4 text-[12.5px] shadow-sm">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Estado del chat</p>
            <dl className="space-y-1.5 text-[var(--text-2)]">
              <div className="flex justify-between gap-2">
                <dt>Sede</dt>
                <dd className="font-semibold text-[var(--text)]">
                  {estado.sucursalId === "a" ? "Yalí" : estado.sucursalId === "b" ? "Costa del Surf" : estado.sucursalId === "c" ? "Playa Linda" : "sin definir"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Mensajes de Sofía</dt>
                <dd className="font-semibold text-[var(--text)]">
                  {usados} de {estado.limite}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>IA en este chat</dt>
                <dd className={cn("font-semibold", apagada ? "text-[#c2410c]" : "text-[#2f9e2f]")}>{apagada ? "apagada" : "activa"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Sesión</dt>
                <dd className="font-mono text-[11px] text-[var(--text-3)]">prueba:{estado.sesionId}</dd>
              </div>
            </dl>
          </div>
          {apartado ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Reserva apartada</p>
              <ApartadoCard a={apartado} compacto onCambio={cargarApartado} />
              <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-3)]">
                Es la misma tarjeta que ve Verónica en la ficha del chat y en el dashboard. Confirmar manda el mensaje de confirmación... a nadie, porque este chat es de prueba.
              </p>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-line p-4 text-[12px] text-[var(--text-3)]">
              Cuando Sofía tenga fechas, personas, habitación, nombre y correo, va a apartar la habitación y acá aparece la tarjeta.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
