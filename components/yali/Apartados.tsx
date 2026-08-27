"use client";

// Los apartados de Sofía, para que Verónica los confirme o los rechace.
//
// Dos lugares: la ficha del chat (ReservaPendienteCard, lo de ESA conversación)
// y el dashboard (ReservasPorConfirmar, todo lo que espera). El mismo cuerpo en
// los dos: sede, habitación, fechas, personas, total, el comprobante si llegó,
// y los dos botones. Confirmar mete la reserva al sistema y le avisa al
// huésped por el mismo canal.

import { useCallback, useEffect, useState } from "react";
import { BedDouble, CheckCircle2, Clock, ExternalLink, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { ImagenAmpliable } from "@/components/ui/Lightbox";

export interface Apartado {
  id: string;
  clave: string;
  sedeNombre: string;
  habitacionNombre: string;
  huesped: string;
  correo: string | null;
  desde: string;
  hasta: string;
  adultos: number;
  ninos: number;
  noches: number;
  total: number;
  estado: "pendiente_pago" | "comprobante_recibido" | "confirmada" | "rechazada";
  comprobanteUrl: string | null;
  comprobanteTs: string | null;
  vence: string | null;
  confirmadaPor: string | null;
  motivoRechazo: string | null;
  reservaCloudbeds: string | null;
  creada: string;
}

const ESTADO: Record<Apartado["estado"], { nombre: string; clase: string }> = {
  pendiente_pago: { nombre: "Esperando el pago", clase: "bg-amber-50 text-amber-800 border-amber-200" },
  comprobante_recibido: { nombre: "Comprobante recibido · verificar", clase: "bg-[var(--brand-accent)]/15 text-[var(--text)] border-[var(--brand-accent)]/40" },
  confirmada: { nombre: "Confirmada", clase: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  rechazada: { nombre: "Rechazada", clase: "bg-surface text-[var(--text-3)] border-line" },
};

function fecha(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

function dinero(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function quedan(vence: string | null): string | null {
  if (!vence) return null;
  const ms = new Date(vence).getTime() - Date.now();
  if (ms <= 0) return "venció la hora de apartado";
  const min = Math.round(ms / 60000);
  return `apartada ${min} min más`;
}

function useApartados(clave?: string, refreshKey = 0, activo = true) {
  const [lista, setLista] = useState<Apartado[] | null>(null);
  const cargar = useCallback(async () => {
    if (!activo) return;
    try {
      const r = await fetch(`/api/yali/prereservas${clave ? `?clave=${encodeURIComponent(clave)}` : ""}`, { cache: "no-store" });
      const d = (await r.json()) as { ok?: boolean; reservas?: Apartado[] };
      setLista(d.ok ? (d.reservas ?? []) : []);
    } catch {
      setLista([]);
    }
  }, [clave, activo]);
  useEffect(() => {
    void cargar();
  }, [cargar, refreshKey]);
  return { lista, cargar };
}

export function ApartadoCard({
  a,
  compacto,
  onCambio,
}: {
  a: Apartado;
  compacto?: boolean;
  onCambio: () => void;
}) {
  const [ocupado, setOcupado] = useState<"confirmar" | "rechazar" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const vivo = a.estado === "pendiente_pago" || a.estado === "comprobante_recibido";
  const e = ESTADO[a.estado];

  async function accion(accion: "confirmar" | "rechazar") {
    let motivo = "";
    if (accion === "rechazar") {
      motivo = window.prompt("¿Por qué se rechaza? (se guarda como nota)") ?? "";
      if (motivo === null) return;
    } else if (!window.confirm(`¿Confirmar la reserva de ${a.huesped} (${a.habitacionNombre}, ${fecha(a.desde)} al ${fecha(a.hasta)}, ${dinero(a.total)})? Se le avisa al huésped por el chat.`)) {
      return;
    }
    setOcupado(accion);
    setAviso(null);
    try {
      const r = await fetch("/api/yali/prereservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: a.id, accion, motivo }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string; enCloudbeds?: boolean; avisado?: boolean; avisoError?: string };
      if (!d.ok) {
        setAviso(d.error ?? "No se pudo.");
      } else if (accion === "confirmar") {
        setAviso(
          `${d.enCloudbeds ? "Quedó en Cloudbeds." : "Quedó en el panel; cárgala en Cloudbeds."} ${d.avisado ? "El huésped ya recibió la confirmación." : `No se pudo avisar al huésped${d.avisoError ? ` (${d.avisoError})` : ""}.`}`,
        );
      }
      onCambio();
    } catch {
      setAviso("No se pudo.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className={cn("rounded-xl border border-line bg-card p-3 text-[12.5px]", compacto ? "" : "shadow-sm")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-[var(--text)]">{a.huesped}</p>
          <p className="truncate text-[var(--text-2)]">
            {a.habitacionNombre} · {a.sedeNombre}
          </p>
        </div>
        <span className="shrink-0 font-mono text-[11px] text-[var(--text-3)]">
          {a.clave.startsWith("prueba:") && (
            <span className="mr-1.5 rounded bg-surface px-1 py-0.5 font-sans text-[10px] font-semibold uppercase text-[var(--text-3)] ring-1 ring-line">prueba</span>
          )}
          {a.id}
        </span>
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[var(--text-2)]">
        <span>
          {fecha(a.desde)} al {fecha(a.hasta)} · {a.noches === 1 ? "1 noche" : `${a.noches} noches`}
        </span>
        <span>
          · {a.adultos + a.ninos} {a.adultos + a.ninos === 1 ? "persona" : "personas"}
        </span>
        <span className="ml-auto font-bold text-[var(--text)]">{dinero(a.total)}</span>
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", e.clase)}>{e.nombre}</span>
        {a.estado === "pendiente_pago" && quedan(a.vence) && (
          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-3)]">
            <Clock size={11} /> {quedan(a.vence)}
          </span>
        )}
        {a.estado === "confirmada" && (
          <span className="text-[11px] text-[var(--text-3)]">
            {a.reservaCloudbeds ? `Cloudbeds ${a.reservaCloudbeds}` : "en el panel"}
            {a.confirmadaPor ? ` · ${a.confirmadaPor}` : ""}
          </span>
        )}
        {a.estado === "rechazada" && a.motivoRechazo && (
          <span className="text-[11px] text-[var(--text-3)]">{a.motivoRechazo}</span>
        )}
      </div>
      {a.comprobanteUrl && (
        <ImagenAmpliable src={a.comprobanteUrl} alt={`Comprobante de ${a.huesped}`} className="mt-2" title="Ver el comprobante en grande">
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand underline">
            Ver comprobante <ExternalLink size={11} />
          </span>
        </ImagenAmpliable>
      )}
      {vivo && (
        <div className="mt-2.5 flex gap-1.5">
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() => accion("confirmar")}
            className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-brand px-2 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {ocupado === "confirmar" ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Confirmar reserva
          </button>
          <button
            type="button"
            disabled={ocupado !== null}
            onClick={() => accion("rechazar")}
            className="inline-flex items-center justify-center gap-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-card disabled:opacity-60"
          >
            {ocupado === "rechazar" ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
            Rechazar
          </button>
        </div>
      )}
      {aviso && <p className="mt-2 text-[11.5px] text-[var(--text-2)]">{aviso}</p>}
    </div>
  );
}

/** En la ficha del chat: lo apartado en ESTA conversación. */
export function ReservaPendienteCard({ clave, refreshKey = 0 }: { clave?: string; refreshKey?: number }) {
  const { lista, cargar } = useApartados(clave, refreshKey, Boolean(clave));
  if (!clave || !lista || lista.length === 0) return null;
  // La viva primero; si no hay viva, la última cerrada (para ver qué pasó).
  const viva = lista.find((a) => a.estado === "pendiente_pago" || a.estado === "comprobante_recibido");
  const a = viva ?? lista[0];
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
        <BedDouble size={12} /> Reserva apartada por Sofía
      </p>
      <ApartadoCard a={a} compacto onCambio={cargar} />
    </div>
  );
}

/** En el dashboard: todo lo que espera confirmación, y lo último cerrado. */
export function ReservasPorConfirmar() {
  const { lista, cargar } = useApartados(undefined, 0, true);
  useEffect(() => {
    const t = setInterval(() => void cargar(), 60_000);
    // Una reserva tomada a mano avisa para no esperar al próximo minuto.
    const alCambiar = () => void cargar();
    window.addEventListener("yali:reservas", alCambiar);
    return () => {
      clearInterval(t);
      window.removeEventListener("yali:reservas", alCambiar);
    };
  }, [cargar]);
  if (!lista) return null;
  const vivas = lista.filter((a) => a.estado === "pendiente_pago" || a.estado === "comprobante_recibido");
  const cerradas = lista.filter((a) => a.estado === "confirmada" || a.estado === "rechazada").slice(0, 4);
  if (vivas.length === 0 && cerradas.length === 0) return null;
  const porVerificar = vivas.filter((a) => a.estado === "comprobante_recibido").length;
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--text)]">Reservas por confirmar</h2>
          <p className="text-[12.5px] text-[var(--text-3)]">
            Las que Sofía dejó apartadas. Cuando llega el comprobante, Verónica verifica el pago y confirma.
          </p>
        </div>
        {porVerificar > 0 && (
          <span className="rounded-full bg-[var(--brand-accent)]/20 px-2.5 py-1 text-[12px] font-bold text-[var(--text)]">
            {porVerificar} con comprobante
          </span>
        )}
      </div>
      {vivas.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {vivas.map((a) => (
            <ApartadoCard key={a.id} a={a} onCambio={cargar} />
          ))}
        </div>
      )}
      {cerradas.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Últimas cerradas</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {cerradas.map((a) => (
              <ApartadoCard key={a.id} a={a} compacto onCambio={cargar} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
