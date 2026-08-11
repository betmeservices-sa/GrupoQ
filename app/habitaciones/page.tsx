"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CalendarRange, Check, Loader2, Users, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";

type Estado = "libre" | "ocupada" | "simulada" | "sin_tarifa" | "capacidad" | "sin_dato";

interface Habitacion {
  id: string;
  nombre: string;
  maxHuespedes: number;
  estado: Estado;
  tarifaNoche?: number;
  totalEstadia?: number;
  reservaSimulada?: { id: string; huesped: string; desde: string; hasta: string };
}

interface Vista {
  propiedad: { nombre: string; moneda: string; simbolo: string } | null;
  desde: string;
  hasta: string;
  noches: number;
  huespedes: number;
  hoy: string;
  habitaciones: Habitacion[];
  resumen: Record<Estado, number>;
  consultado: string;
}

// Cada estado tiene su propio color y su propia trama, para leerlo de un vistazo.
const TONO: Record<Estado, { franja: string; caja: string; texto: string }> = {
  libre: {
    franja: "bg-[var(--brand-blue)]",
    caja: "border-[var(--brand-blue)]/45 bg-[var(--brand-blue)]/[0.07]",
    texto: "text-[var(--text)]",
  },
  ocupada: {
    franja: "bg-[var(--brand-accent)]",
    caja: "border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/[0.09]",
    texto: "text-[var(--brand-accent)]",
  },
  simulada: {
    franja:
      "bg-[var(--brand-blue)] [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,.4)_4px,rgba(255,255,255,.4)_7px)]",
    caja: "border-[var(--brand-blue)] bg-[var(--brand-blue)]/[0.14]",
    texto: "text-brand",
  },
  sin_tarifa: {
    franja:
      "bg-[var(--surface-2)] [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,var(--border-2)_3px,var(--border-2)_5px)]",
    caja: "border-line bg-surface/40",
    texto: "text-[var(--text-3)]",
  },
  capacidad: {
    franja: "bg-[var(--border-2)]",
    caja: "border-line bg-surface/40",
    texto: "text-[var(--text-3)]",
  },
  sin_dato: {
    franja: "bg-transparent ring-1 ring-inset ring-[var(--border-2)]",
    caja: "border-dashed border-[var(--border-2)] bg-transparent",
    texto: "text-[var(--text-3)]",
  },
};

const LEYENDA: Array<{ estado: Estado; label: string }> = [
  { estado: "libre", label: "Libre" },
  { estado: "ocupada", label: "Ocupada" },
  { estado: "simulada", label: "Reserva del demo" },
  { estado: "sin_tarifa", label: "Sin tarifa cargada" },
];

function dinero(v: number, simbolo = "$"): string {
  return `${simbolo}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, d)),
  );
}

function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() + dias);
  return t.toISOString().slice(0, 10);
}

const CAMPO =
  "rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-[var(--text)] outline-none transition focus:border-brand focus:bg-card [color-scheme:dark]";

export default function HabitacionesPage() {
  const router = useRouter();
  // Esta sección se apoya en el sistema de reservas del hotel: en los demás
  // clientes no existe (el menú tampoco la muestra).
  const esHotel = activeTenantId() === "hotel";
  useEffect(() => {
    if (!esHotel) router.replace("/");
  }, [esHotel, router]);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [huespedes, setHuespedes] = useState(1);
  const [vista, setVista] = useState<Vista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(
    async (d?: string, h?: string, g?: number) => {
      setCargando(true);
      const qs = new URLSearchParams();
      if (d) qs.set("desde", d);
      if (h) qs.set("hasta", h);
      qs.set("huespedes", String(g ?? 1));
      try {
        const r = await fetch(`/api/hotel/habitaciones?${qs}`, { cache: "no-store" });
        const data = await r.json();
        if (data.ok) {
          setVista(data.vista);
          setError(null);
          // La primera carga fija el rango que decidió el servidor (hoy y mañana
          // en la zona del hotel, no la del navegador).
          setDesde(data.vista.desde);
          setHasta(data.vista.hasta);
          setHuespedes(data.vista.huespedes);
        } else {
          setError(data.error ?? "No se pudo leer el estado de las habitaciones.");
        }
      } catch {
        setError("No se pudo leer el estado de las habitaciones.");
      }
      setCargando(false);
    },
    [],
  );

  useEffect(() => {
    if (esHotel) cargar();
  }, [cargar, esHotel]);

  const rangoValido = useMemo(() => Boolean(desde && hasta && desde < hasta), [desde, hasta]);

  if (!esHotel) return <div className="flex-1 bg-surface" />;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-5 py-3">
        <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Habitaciones</h1>
        <p className="text-[12.5px] text-[var(--text-3)]">
          {vista
            ? `${vista.propiedad?.nombre ?? ""} · ${vista.habitaciones.length} en el sistema`
            : "Leyendo el sistema de reservas"}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {/* Búsqueda */}
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-card p-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-[var(--text-2)]">Entrada</span>
            <input
              type="date"
              value={desde}
              min={vista?.hoy}
              onChange={(e) => {
                setDesde(e.target.value);
                if (e.target.value && hasta <= e.target.value) setHasta(sumarDias(e.target.value, 1));
              }}
              className={CAMPO}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-[var(--text-2)]">Salida</span>
            <input
              type="date"
              value={hasta}
              min={desde ? sumarDias(desde, 1) : vista?.hoy}
              onChange={(e) => setHasta(e.target.value)}
              className={CAMPO}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-semibold text-[var(--text-2)]">Huéspedes</span>
            <input
              type="number"
              min={1}
              max={20}
              value={huespedes}
              onChange={(e) => setHuespedes(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className={cn(CAMPO, "w-24")}
            />
          </label>
          <button
            type="button"
            onClick={() => cargar(desde, hasta, huespedes)}
            disabled={cargando || !rangoValido}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110 disabled:opacity-60"
          >
            {cargando ? <Loader2 size={15} className="animate-spin" /> : <CalendarRange size={15} />}
            Buscar
          </button>
          {vista && (
            <p className="ml-auto text-[12px] text-[var(--text-3)]">
              {vista.noches} {vista.noches === 1 ? "noche" : "noches"} · {fechaCorta(vista.desde)} al{" "}
              {fechaCorta(vista.hasta)}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12.5px] text-amber-200">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {cargando && !vista && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[150px] animate-pulse rounded-2xl border border-line bg-surface" />
            ))}
          </div>
        )}

        {vista && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12px] text-[var(--text-2)]">
              {LEYENDA.map(({ estado, label }) => (
                <span key={estado} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-3.5 w-3.5 rounded", TONO[estado].franja)} />
                  {label}
                  <span className="font-bold text-[var(--text)]">{vista.resumen[estado]}</span>
                </span>
              ))}
              {vista.resumen.capacidad > 0 && (
                <span className="text-[var(--text-3)]">
                  {vista.resumen.capacidad} no alcanzan para {vista.huespedes}
                </span>
              )}
              {vista.resumen.sin_dato > 0 && (
                <span className="text-[var(--text-3)]">
                  {vista.resumen.sin_dato} sin lectura
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {vista.habitaciones.map((h) => (
                <TarjetaHabitacion
                  key={h.id}
                  hab={h}
                  vista={vista}
                  onReservada={() => cargar(vista.desde, vista.hasta, vista.huespedes)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TarjetaHabitacion({
  hab,
  vista,
  onReservada,
}: {
  hab: Habitacion;
  vista: Vista;
  onReservada: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [falla, setFalla] = useState(false);

  const simbolo = vista.propiedad?.simbolo ?? "$";
  const tono = TONO[hab.estado];

  async function confirmar() {
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
          llegada: vista.desde,
          salida: vista.hasta,
          adultos: vista.huespedes,
          ninos: 0,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setAbierto(false);
        setNombre("");
        setMsg(`${d.reserva} · ${dinero(d.total, simbolo)}`);
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

  // Lo que no se ve por color: el motivo por el que no se puede tomar, o el
  // precio si sí se puede.
  const pie = (() => {
    switch (hab.estado) {
      case "libre":
        return `${dinero(hab.tarifaNoche ?? 0, simbolo)} la noche · ${dinero(hab.totalEstadia ?? 0, simbolo)} por ${vista.noches} ${vista.noches === 1 ? "noche" : "noches"}`;
      case "ocupada":
        return "Ocupada estas fechas";
      case "simulada":
        return `${hab.reservaSimulada?.huesped} · ${fechaCorta(hab.reservaSimulada?.desde ?? "")} al ${fechaCorta(hab.reservaSimulada?.hasta ?? "")}`;
      case "sin_tarifa":
        return "Sin tarifa cargada, no se puede reservar";
      case "capacidad":
        return `No alcanza para ${vista.huespedes} huéspedes`;
      case "sin_dato":
        return "No se pudo leer la disponibilidad";
    }
  })();

  return (
    <div className={cn("overflow-hidden rounded-2xl border shadow-sm", tono.caja)}>
      <div className={cn("h-1.5 w-full", tono.franja)} />
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className={cn("truncate text-[14px] font-bold", tono.texto)}>{hab.nombre}</p>
          {hab.estado === "simulada" && (
            <span className="shrink-0 text-[11px] font-bold text-brand">
              {hab.reservaSimulada?.id}
            </span>
          )}
        </div>
        <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[var(--text-3)]">
          <Users size={12} />
          hasta {hab.maxHuespedes} {hab.maxHuespedes === 1 ? "huésped" : "huéspedes"}
        </p>

        <p
          className={cn(
            "mt-3 text-[12.5px]",
            hab.estado === "libre"
              ? "font-semibold text-[var(--text)]"
              : "text-[var(--text-2)]",
          )}
        >
          {pie}
        </p>

        {hab.estado === "libre" && !abierto && (
          <button
            type="button"
            onClick={() => {
              setAbierto(true);
              setMsg(null);
            }}
            className="mt-3 w-full rounded-xl bg-brand px-3 py-2 text-[13px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110"
          >
            Reservar
          </button>
        )}

        {abierto && (
          <div className="mt-3 space-y-2">
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del huésped"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && nombre.trim()) confirmar();
              }}
              className={cn(CAMPO, "w-full")}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmar}
                disabled={enviando || !nombre.trim()}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-[13px] font-bold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {enviando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => {
                  setAbierto(false);
                  setNombre("");
                }}
                aria-label="Cancelar"
                className="flex h-[34px] w-9 items-center justify-center rounded-xl border border-line text-[var(--text-3)] transition hover:text-[var(--text)]"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {msg && (
          <p
            className={cn(
              "mt-2.5 text-[12px] font-semibold",
              falla ? "text-rose-400" : "text-brand",
            )}
          >
            {msg}
            {!falla && (
              <Link
                href="/dashboard"
                className="ml-2 font-medium text-[var(--text-3)] underline underline-offset-2 transition hover:text-[var(--text-2)]"
              >
                Ver en el calendario
              </Link>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
