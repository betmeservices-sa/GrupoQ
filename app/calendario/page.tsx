"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";

interface TipoLibre {
  id: string;
  nombre: string;
  maxHuespedes: number;
  tarifa: number;
}
interface TomaSimulada {
  id: string;
  tipoNombre: string;
  huesped: string;
  desde: string;
  hasta: string;
}
interface TomaPms {
  id: string;
  huesped: string;
  desde: string;
  hasta: string;
  fuente: string;
}
interface Dia {
  fecha: string;
  dia: number;
  pasado: boolean;
  leido: boolean;
  libres: TipoLibre[];
  simuladas: TomaSimulada[];
  reservas: TomaPms[];
}
interface Mes {
  anio: number;
  mes: number;
  hoy: string;
  huespedes: number;
  reservables: number | null;
  dias: Dia[];
  propiedad: { nombre: string; simbolo: string } | null;
  consultado: string;
}

const DOW = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function dinero(v: number, simbolo = "$"): string {
  return `${simbolo}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() + dias);
  return t.toISOString().slice(0, 10);
}

// Lunes = 0, para que la semana arranque donde la lee la gente aquí.
function diaSemanaLunes(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  return (new Date(Date.UTC(a, m - 1, d)).getUTCDay() + 6) % 7;
}

function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, d)),
  );
}

// Iniciales del huésped para la celda del mes: "Rocío Herrera" -> "RH".
function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return (partes[0][0] + (partes[1]?.[0] ?? "")).toUpperCase();
}

const CAMPO =
  "rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-[var(--text)] outline-none transition focus:border-brand focus:bg-card";

export default function CalendarioPage() {
  const router = useRouter();
  const esHotel = activeTenantId() === "hotel";
  useEffect(() => {
    if (!esHotel) router.replace("/");
  }, [esHotel, router]);

  const [mes, setMes] = useState<Mes | null>(null);
  const [pedido, setPedido] = useState<{ anio: number; mes: number } | null>(null);
  const [huespedes, setHuespedes] = useState(1);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async (anio?: number, m?: number, g = 1) => {
    setCargando(true);
    const qs = new URLSearchParams({ huespedes: String(g) });
    if (anio && m) {
      qs.set("anio", String(anio));
      qs.set("mes", String(m));
    }
    try {
      const r = await fetch(`/api/hotel/calendario?${qs}`, { cache: "no-store" });
      const d = await r.json();
      if (d.ok) {
        setMes(d.mes);
        setPedido({ anio: d.mes.anio, mes: d.mes.mes });
        setError(null);
      } else {
        setError(d.error ?? "No se pudo leer la disponibilidad del mes.");
      }
    } catch {
      setError("No se pudo leer la disponibilidad del mes.");
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (esHotel) cargar();
  }, [cargar, esHotel]);

  function mover(delta: number) {
    if (!pedido) return;
    let m = pedido.mes + delta;
    let a = pedido.anio;
    if (m < 1) {
      m = 12;
      a -= 1;
    } else if (m > 12) {
      m = 1;
      a += 1;
    }
    // Cambiar de mes limpia el día elegido: no tiene sentido dejar seleccionado
    // un día que ya no está en pantalla.
    setSeleccion(null);
    setPedido({ anio: a, mes: m });
    cargar(a, m, huespedes);
  }

  const diaSel = useMemo(
    () => (seleccion ? mes?.dias.find((d) => d.fecha === seleccion) ?? null : null),
    [seleccion, mes],
  );

  // Relleno para que el 1 caiga en su día de la semana.
  const huecos = mes && mes.dias.length > 0 ? diaSemanaLunes(mes.dias[0].fecha) : 0;
  const tope = mes?.reservables ?? 0;

  if (!esHotel) return <div className="flex-1 bg-surface" />;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-5 py-3">
        <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Calendario</h1>
        <p className="text-[12.5px] text-[var(--text-3)]">
          {mes
            ? `${mes.propiedad?.nombre ?? ""} · habitaciones libres noche por noche`
            : "Leyendo el sistema de reservas"}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => mover(-1)}
              disabled={cargando}
              aria-label="Mes anterior"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-card text-[var(--text-2)] transition hover:bg-surface disabled:opacity-50"
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              onClick={() => mover(1)}
              disabled={cargando}
              aria-label="Mes siguiente"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-card text-[var(--text-2)] transition hover:bg-surface disabled:opacity-50"
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <p className="min-w-[190px] text-[15px] font-extrabold tracking-tight text-[var(--text)] first-letter:uppercase">
            {pedido ? `${MESES[pedido.mes - 1]} ${pedido.anio}` : ""}
          </p>
          {cargando && <Loader2 size={16} className="animate-spin text-brand" />}

          <label className="ml-auto flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[var(--text-2)]">Huéspedes</span>
            <input
              type="number"
              min={1}
              max={20}
              value={huespedes}
              onChange={(e) => {
                const g = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                setHuespedes(g);
                if (pedido) cargar(pedido.anio, pedido.mes, g);
              }}
              className={cn(CAMPO, "w-20")}
            />
          </label>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/10 px-4 py-3 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
            <p>{error}</p>
          </div>
        )}

        {mes && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <div className="mb-2 grid grid-cols-7 gap-1.5">
                {DOW.map((d) => (
                  <p
                    key={d}
                    className="py-1 text-center text-[11px] font-bold uppercase tracking-wide text-[var(--text-3)]"
                  >
                    {d}
                  </p>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: huecos }).map((_, i) => (
                  <div key={`h${i}`} />
                ))}
                {mes.dias.map((d) => (
                  <CeldaDia
                    key={d.fecha}
                    dia={d}
                    tope={tope}
                    esHoy={d.fecha === mes.hoy}
                    activo={d.fecha === seleccion}
                    onClick={() => setSeleccion(d.fecha === seleccion ? null : d.fecha)}
                  />
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3 text-[12px] text-[var(--text-2)]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded bg-brand" />
                  Todo libre
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded bg-brand/25 ring-1 ring-inset ring-brand/40" />
                  Queda poco
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded bg-[var(--brand-accent)]" />
                  Sin nada libre
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex h-3.5 w-5 items-end overflow-hidden rounded border-2 border-[var(--text)]">
                    <span className="h-1.5 w-full bg-[var(--brand-blue-dark)]" />
                  </span>
                  Reserva del demo
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="flex h-3.5 w-5 items-end overflow-hidden rounded border-2 border-[var(--text)]">
                    <span className="h-1.5 w-full bg-[var(--brand-accent)]" />
                  </span>
                  Reserva del sistema
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded border border-dashed border-[var(--border-2)]" />
                  Sin lectura
                </span>
                {mes.reservables !== null && (
                  <span className="ml-auto text-[var(--text-3)]">
                    {mes.reservables} habitaciones con tarifa cargada
                  </span>
                )}
              </div>
            </div>

            <DetalleDia
              dia={diaSel}
              mes={mes}
              onReservada={() => cargar(pedido?.anio, pedido?.mes, huespedes)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function CeldaDia({
  dia,
  tope,
  esHoy,
  activo,
  onClick,
}: {
  dia: Dia;
  tope: number;
  esHoy: boolean;
  activo: boolean;
  onClick: () => void;
}) {
  const n = dia.libres.length;
  const lleno = tope > 0 ? n / tope : 0;
  const tomas = [...dia.reservas, ...dia.simuladas];
  const conReserva = tomas.length > 0;
  const soloDemo = dia.reservas.length === 0;

  // Sin lectura no se pinta disponibilidad: no se sabe.
  const sinLectura = !dia.leido && !dia.pasado;
  const disponible = dia.leido && !dia.pasado;
  // Un día que ya pasó no se puede reservar, pero si tiene reservas igual se
  // abre para ver de quién son.
  const seleccionable = disponible || conReserva;

  const quienes = tomas.map((t) => t.huesped).join(", ");
  const titulo = conReserva
    ? `${fechaLarga(dia.fecha)}: reservado por ${quienes}${
        disponible ? ` · ${n} ${n === 1 ? "habitación libre" : "habitaciones libres"}` : ""
      }`
    : dia.pasado
      ? `${fechaLarga(dia.fecha)}: ya pasó`
      : !dia.leido
        ? `${fechaLarga(dia.fecha)}: no se pudo leer la disponibilidad`
        : `${fechaLarga(dia.fecha)}: ${n} ${n === 1 ? "habitación libre" : "habitaciones libres"}`;

  return (
    <button
      type="button"
      onClick={seleccionable ? onClick : undefined}
      disabled={!seleccionable}
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      className={cn(
        "relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-xl border transition",
        dia.pasado && !conReserva && "border-transparent bg-surface/40 text-[var(--text-3)]",
        dia.pasado && conReserva && "bg-surface/40",
        sinLectura && "border-dashed border-[var(--border-2)] bg-transparent",
        disponible && "border-line hover:border-brand",
        seleccionable && !disponible && "cursor-pointer hover:border-brand",
        // Un día reservado se distingue por PESO y FORMA, no solo por color:
        // borde grueso y una franja llena abajo con las iniciales del huésped.
        conReserva && "border-2 border-[var(--text)] shadow-sm",
        activo && "ring-2 ring-brand ring-offset-1 ring-offset-[var(--card)]",
      )}
      style={
        disponible
          ? {
              backgroundColor:
                n === 0
                  ? "color-mix(in srgb, var(--brand-accent) 22%, transparent)"
                  : `color-mix(in srgb, var(--brand-blue) ${Math.round(12 + lleno * 68)}%, transparent)`,
              borderColor:
                n === 0 && !conReserva
                  ? "color-mix(in srgb, var(--brand-accent) 45%, transparent)"
                  : undefined,
            }
          : undefined
      }
    >
      <span
        className={cn(
          "text-[13px] font-bold leading-none",
          esHoy && "underline decoration-2 underline-offset-2",
          disponible && lleno > 0.55 ? "text-white" : "text-[var(--text)]",
          dia.pasado && !conReserva && "font-medium text-[var(--text-3)]",
          sinLectura && "text-[var(--text-3)]",
          conReserva && "mb-0.5",
        )}
      >
        {dia.dia}
      </span>
      {disponible && (
        <span
          className={cn(
            "text-[11px] font-semibold leading-none tabular-nums",
            lleno > 0.55 ? "text-white/85" : "text-[var(--text-2)]",
          )}
        >
          {n}
        </span>
      )}
      {sinLectura && <span className="text-[11px] font-bold text-[var(--text-3)]">?</span>}

      {conReserva && (
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 flex h-[22px] items-center justify-center gap-1 px-1",
            soloDemo ? "bg-[var(--brand-blue-dark)]" : "bg-[var(--brand-accent)]",
          )}
        >
          {/* La trama marca lo simulado del demo; lo del sistema va liso. */}
          {soloDemo && (
            <span
              aria-hidden
              className="h-3 w-2 shrink-0 rounded-[2px] bg-white/85 [background-image:repeating-linear-gradient(45deg,transparent,transparent_1.5px,var(--brand-blue-dark)_1.5px,var(--brand-blue-dark)_3px)]"
            />
          )}
          <span className="truncate text-[10.5px] font-extrabold uppercase leading-none tracking-wide text-white">
            {iniciales(tomas[0].huesped)}
            {tomas.length > 1 ? ` +${tomas.length - 1}` : ""}
          </span>
        </span>
      )}
    </button>
  );
}

function DetalleDia({
  dia,
  mes,
  onReservada,
}: {
  dia: Dia | null;
  mes: Mes;
  onReservada: () => void;
}) {
  const simbolo = mes.propiedad?.simbolo ?? "$";
  const tomas = dia ? [...dia.reservas, ...dia.simuladas] : [];
  const [abierta, setAbierta] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [falla, setFalla] = useState(false);

  useEffect(() => {
    setAbierta(null);
    setNombre("");
    setMsg(null);
  }, [dia?.fecha]);

  if (!dia) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card/50 p-8 text-center">
        <p className="text-sm font-bold text-[var(--text)]">Elige un día</p>
        <p className="mt-1 max-w-[220px] text-[12.5px] text-[var(--text-3)]">
          Te muestra qué habitaciones quedan esa noche y con qué tarifa.
        </p>
      </div>
    );
  }

  async function reservar(hab: TipoLibre) {
    setEnviando(true);
    setMsg(null);
    setFalla(false);
    try {
      const r = await fetch("/api/hotel/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          habitacion: hab.nombre,
          llegada: dia!.fecha,
          salida: sumarDias(dia!.fecha, 1),
          adultos: mes.huespedes,
          ninos: 0,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setAbierta(null);
        setNombre("");
        setMsg(`${d.reserva} · ${hab.nombre} · ${dinero(d.total, simbolo)}`);
        onReservada();
      } else {
        setFalla(true);
        setMsg(d.error ?? "No se pudo tomar la reserva.");
      }
    } catch {
      setFalla(true);
      setMsg("No se pudo tomar la reserva.");
    }
    setEnviando(false);
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
      {/* Solo la inicial: "capitalize" pondría mayúscula en cada palabra. */}
      <p className="text-sm font-bold text-[var(--text)] first-letter:uppercase">
        {fechaLarga(dia.fecha)}
      </p>
      <p className="mt-0.5 text-[12px] text-[var(--text-3)]">
        {/* De una noche que no se consultó (ya pasó) no se dice cuánto queda. */}
        {tomas.length > 0
          ? `${tomas.length} ${tomas.length === 1 ? "reserva" : "reservas"}${
              dia.leido
                ? ` · ${dia.libres.length} ${dia.libres.length === 1 ? "habitación libre" : "libres"}`
                : ""
            }`
          : dia.libres.length === 0
            ? "Ninguna habitación disponible esa noche"
            : `${dia.libres.length} ${dia.libres.length === 1 ? "habitación" : "habitaciones"} para ${mes.huespedes} ${mes.huespedes === 1 ? "huésped" : "huéspedes"}`}
      </p>

      {/* Primero lo reservado y a nombre de quién; después lo que queda. */}
      {tomas.length > 0 && (
        <ul className="mt-3 space-y-2">
          {dia.reservas.map((r) => (
            <li
              key={r.id}
              className="overflow-hidden rounded-xl border border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/[0.09]"
            >
              <div className="flex">
                <span aria-hidden className="w-1.5 shrink-0 bg-[var(--brand-accent)]" />
                <div className="min-w-0 flex-1 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13px] font-bold text-[var(--text)]">{r.huesped}</p>
                    <span className="shrink-0 text-[10.5px] font-bold text-[var(--text-3)]">
                      {r.id}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-[var(--text-2)]">
                    {fechaCorta(r.desde)} al {fechaCorta(r.hasta)} · {r.fuente}
                  </p>
                </div>
              </div>
            </li>
          ))}
          {dia.simuladas.map((s) => (
            <li key={s.id} className="overflow-hidden rounded-xl border border-brand/50 bg-brand/[0.10]">
              <div className="flex">
                <span
                  aria-hidden
                  className="w-1.5 shrink-0 bg-[var(--brand-blue-dark)] [background-image:repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,255,255,.75)_2px,rgba(255,255,255,.75)_4px)]"
                />
                <div className="min-w-0 flex-1 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[13px] font-bold text-[var(--text)]">{s.huesped}</p>
                    <span className="shrink-0 text-[10.5px] font-bold text-brand">{s.id}</span>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-[var(--text-2)]">
                    {s.tipoNombre} · {fechaCorta(s.desde)} al {fechaCorta(s.hasta)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {dia.libres.length > 0 && tomas.length > 0 && (
        <p className="mt-4 border-t border-line pt-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-3)]">
          Queda libre
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {dia.libres.map((h) => (
          <li key={h.id} className="rounded-xl border border-line bg-surface/60 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[13px] font-bold text-[var(--text)]">{h.nombre}</p>
              <span className="shrink-0 text-[13px] font-extrabold text-brand">
                {dinero(h.tarifa, simbolo)}
              </span>
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[var(--text-3)]">
              <Users size={12} />
              hasta {h.maxHuespedes} {h.maxHuespedes === 1 ? "huésped" : "huéspedes"}
            </p>

            {abierta === h.id ? (
              <div className="mt-2 space-y-2">
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Nombre del huésped"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && nombre.trim()) reservar(h);
                  }}
                  className={cn(CAMPO, "w-full")}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => reservar(h)}
                    disabled={enviando || !nombre.trim()}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-[12.5px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    {enviando ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                    Confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbierta(null)}
                    aria-label="Cancelar"
                    className="flex h-[34px] w-9 items-center justify-center rounded-xl border border-line text-[var(--text-3)] transition hover:text-[var(--text)]"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAbierta(h.id);
                  setMsg(null);
                }}
                className="mt-2 w-full rounded-xl bg-brand px-3 py-1.5 text-[12.5px] font-bold text-white transition hover:brightness-110"
              >
                Reservar esta noche
              </button>
            )}
          </li>
        ))}
      </ul>

      {msg && (
        <p
          className={cn(
            "mt-3 text-[12px] font-semibold",
            falla ? "text-[var(--brand-red)]" : "text-brand",
          )}
        >
          {msg}
        </p>
      )}
    </div>
  );
}
