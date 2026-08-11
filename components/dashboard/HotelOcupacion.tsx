"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BedDouble,
  CalendarCheck,
  CalendarX,
  CircleDollarSign,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/cn";

type EstadoNoche = "libre" | "ocupada" | "simulada" | "sin_tarifa" | "sin_dato";

interface CeldaNoche {
  fecha: string;
  estado: EstadoNoche;
  tarifa?: number;
}
interface FilaHabitacion {
  id: string;
  nombre: string;
  maxHuespedes: number;
  reservable: boolean;
  tarifaNoche?: number;
  noches: CeldaNoche[];
}
interface ReservaPms {
  id: string;
  huesped: string;
  desde: string;
  hasta: string;
  adultos: number;
  ninos: number;
  estado: string;
  saldo: number;
  fuente: string;
}
interface ReservaSimulada {
  id: string;
  huesped: string;
  tipoNombre: string;
  desde: string;
  hasta: string;
  adultos: number;
  ninos: number;
  tarifaTotal: number;
  origen: string;
}
interface Panel {
  propiedad: { nombre: string; moneda: string; simbolo: string; zonaHoraria: string } | null;
  hoy: string;
  dias: number;
  fechas: string[];
  filas: FilaHabitacion[];
  kpis: {
    tipos: number;
    reservables: number;
    sinTarifa: number;
    ocupadasHoy: number;
    libresHoy: number;
    ocupacionHoyPct: number;
    nochesOcupadas: number;
    nochesVendibles: number;
    saldoPorCobrar: number;
    reservasPms: number;
    reservasSimuladas: number;
    nochesSinDato: number;
  };
  reservas: ReservaPms[];
  simuladas: ReservaSimulada[];
  consultado: string;
}

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function partes(fecha: string): { dia: number; dow: string; finde: boolean } {
  const [a, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  const dow = t.getUTCDay();
  return { dia: d, dow: DOW[dow], finde: dow === 0 || dow === 6 };
}

function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, d)),
  );
}

function dinero(v: number, simbolo = "$"): string {
  return `${simbolo}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CELDA: Record<EstadoNoche, string> = {
  libre: "bg-[var(--brand-blue)]/18 ring-1 ring-inset ring-[var(--brand-blue)]/45",
  ocupada: "bg-[var(--brand-accent)]",
  simulada:
    "bg-[var(--brand-blue)] ring-1 ring-inset ring-white/30 [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,rgba(255,255,255,.35)_3px,rgba(255,255,255,.35)_5px)]",
  sin_tarifa:
    "bg-[var(--surface-2)] [background-image:repeating-linear-gradient(45deg,transparent,transparent_3px,var(--border-2)_3px,var(--border-2)_4.5px)]",
  sin_dato: "bg-transparent ring-1 ring-inset ring-[var(--border-2)]",
};

const TITULO: Record<EstadoNoche, string> = {
  libre: "Libre",
  ocupada: "Ocupada",
  simulada: "Reserva simulada del demo",
  sin_tarifa: "Sin tarifa en el sistema",
  sin_dato: "El sistema no respondió esta noche",
};

// Panel de ocupación del hotel. Los datos salen del PMS por /api/hotel/panel: el
// navegador nunca ve la llave del sistema del hotel.
export function HotelOcupacion() {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const r = await fetch("/api/hotel/panel", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) {
        setPanel(d.panel);
        setError(null);
      } else {
        setError(d.error ?? "No se pudo leer la ocupación.");
      }
    } catch {
      setError("No se pudo leer la ocupación.");
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (cargando && !panel) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-card p-5 text-[13px] text-[var(--text-2)]">
        <Loader2 size={15} className="animate-spin text-brand" />
        Leyendo ocupación y tarifas
      </div>
    );
  }

  if (!panel) {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-[12.5px] text-amber-200">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <p>{error ?? "Sin datos de ocupación."}</p>
      </div>
    );
  }

  const simbolo = panel.propiedad?.simbolo ?? "$";

  return (
    <section className="space-y-4">
      <Encabezado panel={panel} onRecargar={() => cargar(true)} cargando={cargando} />
      <Kpis panel={panel} simbolo={simbolo} />
      {panel.kpis.nochesSinDato > 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-line bg-surface/60 px-3.5 py-2.5 text-[12.5px] text-[var(--text-2)]">
          <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
          Algunas noches no se pudieron leer y quedaron fuera del cálculo. Vuelve a actualizar en
          un momento.
        </p>
      )}
      {panel.kpis.sinTarifa > 0 && <SinTarifa panel={panel} />}
      <Calendario panel={panel} simbolo={simbolo} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Tarifas panel={panel} simbolo={simbolo} />
        <div className="space-y-4">
          <Simuladas panel={panel} simbolo={simbolo} onCambio={() => cargar(true)} />
          <Reservas panel={panel} simbolo={simbolo} />
        </div>
      </div>
    </section>
  );
}

function Encabezado({
  panel,
  onRecargar,
  cargando,
}: {
  panel: Panel;
  onRecargar: () => void;
  cargando: boolean;
}) {
  const hora = new Date(panel.consultado).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-sm font-bold text-[var(--text)]">
          Ocupación y tarifas del sistema de reservas
        </h2>
        <p className="text-[12px] text-[var(--text-3)]">
          {panel.propiedad?.nombre} · próximas {panel.dias} noches · leído a las {hora}
        </p>
      </div>
      <button
        type="button"
        onClick={onRecargar}
        disabled={cargando}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-60"
      >
        <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
        Actualizar
      </button>
    </div>
  );
}

function Kpis({ panel, simbolo }: { panel: Panel; simbolo: string }) {
  const k = panel.kpis;
  const tarjetas = [
    {
      Icon: BedDouble,
      valor: `${k.ocupacionHoyPct}%`,
      label: `Ocupación hoy · ${k.ocupadasHoy} de ${k.reservables}`,
    },
    { Icon: CalendarCheck, valor: `${k.libresHoy}`, label: "Habitaciones libres hoy" },
    {
      Icon: CalendarX,
      valor: `${k.nochesOcupadas} / ${k.nochesVendibles}`,
      label: `Noches ocupadas de aquí a ${panel.dias} días`,
    },
    {
      Icon: CircleDollarSign,
      valor: dinero(k.saldoPorCobrar, simbolo),
      label: `Saldo por cobrar · ${k.reservasPms} ${k.reservasPms === 1 ? "reserva" : "reservas"}`,
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tarjetas.map((t) => (
        <div key={t.label} className="rounded-2xl border border-line bg-card p-4 shadow-sm">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <t.Icon size={18} />
          </span>
          <p className="mt-3 text-[26px] font-extrabold leading-none tracking-tight text-[var(--text)]">
            {t.valor}
          </p>
          <p className="mt-1.5 text-[12.5px] font-medium text-[var(--text-3)]">{t.label}</p>
        </div>
      ))}
    </div>
  );
}

function SinTarifa({ panel }: { panel: Panel }) {
  const k = panel.kpis;
  const nombres = panel.filas.filter((f) => !f.reservable).map((f) => f.nombre);
  return (
    <div className="rounded-2xl border border-[var(--brand-accent)]/50 bg-[var(--brand-accent)]/10 p-4">
      <p className="text-[13px] font-bold text-[var(--text)]">
        {k.sinTarifa} de {k.tipos} habitaciones no se pueden reservar
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-2)]">
        No tienen tarifa cargada, así que el sistema no las devuelve en disponibilidad en ninguna
        de las próximas {panel.dias} noches. Ni el motor de reservas ni el agente de WhatsApp
        pueden venderlas. Se activan cargando su tarifa.
      </p>
      <p className="mt-2 text-[11.5px] text-[var(--text-3)]">{nombres.join(" · ")}</p>
    </div>
  );
}

function Calendario({ panel, simbolo }: { panel: Panel; simbolo: string }) {
  const cabeceras = useMemo(() => panel.fechas.map(partes), [panel.fechas]);
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[var(--text-2)]">
        <h3 className="mr-auto text-sm font-bold text-[var(--text)]">Calendario por habitación</h3>
        {(
          [
            "libre",
            "ocupada",
            "simulada",
            "sin_tarifa",
            ...(panel.kpis.nochesSinDato > 0 ? (["sin_dato"] as const) : []),
          ] as EstadoNoche[]
        ).map((e) => (
          <span key={e} className="inline-flex items-center gap-1.5">
            <span className={cn("h-3.5 w-3.5 rounded", CELDA[e])} />
            {TITULO[e]}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto pb-1">
        <table className="w-full min-w-[760px] border-separate border-spacing-[2px]">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-card" />
              {cabeceras.map((c, i) => (
                <th
                  key={panel.fechas[i]}
                  className={cn(
                    "px-1 pb-1 text-center text-[11.5px] font-semibold",
                    c.finde ? "text-brand" : "text-[var(--text-2)]",
                  )}
                >
                  {c.dia}
                  <span className="block text-[10px] font-normal uppercase tracking-wide text-[var(--text-3)]">
                    {c.dow}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {panel.filas.map((f) => (
              <tr key={f.id}>
                <td className="sticky left-0 z-10 min-w-[170px] max-w-[210px] bg-card pr-3">
                  <p
                    className={cn(
                      "truncate text-[12.5px] font-semibold",
                      f.reservable ? "text-[var(--text)]" : "text-[var(--text-3)]",
                    )}
                  >
                    {f.nombre}
                  </p>
                  <p className="text-[11px] text-[var(--text-3)]">
                    hasta {f.maxHuespedes} {f.maxHuespedes === 1 ? "huésped" : "huéspedes"}
                    {f.tarifaNoche ? ` · ${dinero(f.tarifaNoche, simbolo)} la noche` : ""}
                  </p>
                </td>
                {f.noches.map((c) => (
                  <td key={c.fecha} className="p-0">
                    <div
                      title={`${f.nombre} · ${fechaCorta(c.fecha)}: ${TITULO[c.estado]}${
                        c.tarifa ? ` · ${dinero(c.tarifa, simbolo)}` : ""
                      }`}
                      className={cn("h-7 min-w-[30px] rounded", CELDA[c.estado])}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tarifas({ panel, simbolo }: { panel: Panel; simbolo: string }) {
  const filas = panel.filas
    .filter((f) => f.reservable && f.tarifaNoche)
    .sort((a, b) => (b.tarifaNoche ?? 0) - (a.tarifaNoche ?? 0));
  const max = Math.max(1, ...filas.map((f) => f.tarifaNoche ?? 0));

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[var(--text)]">Tarifa por noche</h3>
      <p className="mb-4 text-[12px] text-[var(--text-3)]">
        Base para un adulto, en {panel.propiedad?.moneda ?? "USD"}. Sube con más huéspedes.
      </p>
      <div className="space-y-3">
        {filas.map((f) => (
          <div key={f.id} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-[12.5px] font-medium text-[var(--text-2)]">
              {f.nombre}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-brand"
                style={{ width: `${((f.tarifaNoche ?? 0) / max) * 100}%` }}
              />
            </div>
            <span className="w-20 shrink-0 text-right text-[12.5px] font-bold text-[var(--text)]">
              {dinero(f.tarifaNoche ?? 0, simbolo)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Reservas({ panel, simbolo }: { panel: Panel; simbolo: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[var(--text)]">Reservas en el sistema</h3>
      <p className="mb-3 text-[12px] text-[var(--text-3)]">
        Lo que el hotel tiene cargado hasta hoy.
      </p>
      {panel.reservas.length === 0 ? (
        <p className="text-[12.5px] text-[var(--text-2)]">Todavía no hay reservas registradas.</p>
      ) : (
        <ul className="space-y-2.5">
          {panel.reservas.map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-surface/60 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-bold text-[var(--text)]">{r.huesped}</p>
                <span className="text-[11px] font-semibold text-[var(--text-3)]">{r.id}</span>
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                {fechaCorta(r.desde)} al {fechaCorta(r.hasta)} · {r.adultos}{" "}
                {r.adultos === 1 ? "adulto" : "adultos"}
                {r.ninos > 0 ? ` y ${r.ninos} ${r.ninos === 1 ? "niño" : "niños"}` : ""} ·{" "}
                {r.fuente}
              </p>
              {r.saldo > 0 && (
                <span className="mt-1.5 inline-block rounded-full bg-[var(--brand-accent)]/15 px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--brand-accent)]">
                  {dinero(r.saldo, simbolo)} pendiente
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Simuladas({
  panel,
  simbolo,
  onCambio,
}: {
  panel: Panel;
  simbolo: string;
  onCambio: () => void;
}) {
  const reservables = panel.filas.filter((f) => f.reservable);
  const [habitacion, setHabitacion] = useState(reservables[0]?.nombre ?? "");
  const [nombre, setNombre] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [falla, setFalla] = useState(false);

  const llegada = panel.fechas[1] ?? panel.hoy;
  const salida = panel.fechas[3] ?? panel.hoy;

  const input =
    "w-full rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-[var(--text)] outline-none transition focus:border-brand focus:bg-card";

  async function tomar() {
    setEnviando(true);
    setMsg(null);
    setFalla(false);
    try {
      const r = await fetch("/api/hotel/reservas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim() || "Huésped de prueba",
          habitacion: habitacion || reservables[0]?.nombre,
          llegada,
          salida,
          adultos: 1,
          ninos: 0,
        }),
      });
      const d = await r.json();
      if (d.ok) {
        setMsg(
          `${d.reserva} · ${d.habitacion}, ${fechaCorta(d.llegada)} al ${fechaCorta(d.salida)}, ${dinero(d.total, simbolo)}`,
        );
        setNombre("");
        onCambio();
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

  async function limpiar() {
    await fetch("/api/hotel/reservas", { method: "DELETE" });
    setMsg(null);
    onCambio();
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Sparkles size={15} className="text-brand" />
        <h3 className="text-sm font-bold text-[var(--text)]">Reservas que cierra el agente</h3>
      </div>
      <p className="mb-3 mt-1 text-[12px] leading-relaxed text-[var(--text-3)]">
        El agente cotiza con la disponibilidad y las tarifas del sistema, y confirma la reserva
        aquí. No se escribe nada en el sistema del hotel, así que no se bloquea inventario ni se
        avisa a los canales de venta.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[130px] flex-1">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--text-2)]">
            Huésped
          </span>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Nombre completo"
            className={input}
          />
        </label>
        <label className="min-w-[150px] flex-1">
          <span className="mb-1 block text-[11.5px] font-semibold text-[var(--text-2)]">
            Habitación
          </span>
          <select
            value={habitacion}
            onChange={(e) => setHabitacion(e.target.value)}
            className={input}
          >
            {reservables.map((f) => (
              <option key={f.id} value={f.nombre}>
                {f.nombre}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={tomar}
          disabled={enviando || reservables.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-[13px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110 disabled:opacity-60"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <CalendarCheck size={14} />}
          Tomar {fechaCorta(llegada)} al {fechaCorta(salida)}
        </button>
      </div>

      {msg && (
        <p
          className={cn(
            "mt-2.5 text-[12px] font-semibold",
            falla ? "text-rose-400" : "text-brand",
          )}
        >
          {msg}
        </p>
      )}

      {panel.simuladas.length > 0 && (
        <>
          <ul className="mt-3 space-y-2">
            {panel.simuladas.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-brand/40 bg-brand/[0.08] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[13px] font-bold text-[var(--text)]">{r.huesped}</p>
                  <span className="text-[11px] font-semibold text-brand">{r.id}</span>
                </div>
                <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                  {r.tipoNombre} · {fechaCorta(r.desde)} al {fechaCorta(r.hasta)} ·{" "}
                  {dinero(r.tarifaTotal, simbolo)} ·{" "}
                  {r.origen === "agente" ? "por WhatsApp" : "desde el panel"}
                </p>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={limpiar}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:border-rose-400/50 hover:text-rose-400"
          >
            <Trash2 size={13} />
            Vaciar
          </button>
        </>
      )}
    </div>
  );
}
