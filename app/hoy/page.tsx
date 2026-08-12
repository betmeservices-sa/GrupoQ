"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarPlus,
  CircleDollarSign,
  DoorOpen,
  LogIn,
  LogOut,
  NotebookPen,
  RefreshCw,
  SprayCan,
  Tag,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";

interface Movimiento {
  id: string;
  huesped: string;
  estado: string;
  desde: string;
  hasta: string;
  noches: number;
  adultos: number;
  ninos: number;
  habitaciones: string[];
  tipos: string[];
  saldo: number;
  fuente: string;
  fuenteExterna: boolean;
  sinAsignar: number;
}
interface EnCasa {
  reservaId: string;
  huesped: string;
  habitacion: string;
  desde: string;
  hasta: string;
  correo: string;
  telefono: string;
}
interface Limpieza {
  habitacionId: string;
  habitacion: string;
  tipo: string;
  condicion: string;
  ocupada: boolean;
  bloqueada: boolean;
  noMolestar: boolean;
  comentario: string;
}
interface Bloqueo {
  id: string;
  habitacion: string;
  tipo: string;
  desde: string;
  hasta: string;
  motivo: string;
}
interface HabitacionLibre {
  id: string;
  nombre: string;
  tipo: string;
  maxHuespedes: number;
}
interface Panel {
  propiedad: { nombre: string; moneda: string; simbolo: string } | null;
  hoy: string;
  ventana: number;
  llegadas: Movimiento[] | null;
  salidas: Movimiento[] | null;
  enCasa: EnCasa[] | null;
  sinHabitacion: Movimiento[] | null;
  libres: HabitacionLibre[] | null;
  limpieza: {
    listas: number;
    porLimpiar: number;
    revisadas: number;
    sinServicio: number;
    pendientes: Limpieza[];
    total: number;
  } | null;
  bloqueos: Bloqueo[] | null;
  faltantes: string[];
  consultado: string;
}
interface Capacidades {
  tipos: number;
  conTarifa: number;
  sinTarifa: number;
  cobro: Array<{ codigo: string; nombre: string; tarjetas: string[] }>;
  direccion: { pais: string; zip: string; ciudad: string; estado: string; linea1: string } | null;
  avisos: string[];
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

function fechaCorta(fecha: string): string {
  if (!fecha) return "";
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(Date.UTC(a, m - 1, d)),
  );
}

function dinero(v: number, simbolo = "$"): string {
  return `${simbolo}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const CONDICION: Record<string, string> = {
  clean: "Lista",
  dirty: "Por limpiar",
  inspected: "Revisada",
  no_service: "Sin servicio",
};

export default function HoyPage() {
  const router = useRouter();
  // Esta pantalla lee el sistema de reservas del hotel: en los demás clientes no
  // existe (el menú tampoco la muestra).
  const esHotel = activeTenantId() === "hotel";
  useEffect(() => {
    if (!esHotel) router.replace("/");
  }, [esHotel, router]);

  const [panel, setPanel] = useState<Panel | null>(null);
  const [capacidades, setCapacidades] = useState<Capacidades | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const r = await fetch("/api/hotel/dia", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) {
        setPanel(d.panel);
        setError(null);
      } else {
        setError(d.error ?? "No se pudo leer el día.");
      }
    } catch {
      setError("No se pudo leer el día.");
    }
    setCargando(false);
    // La sección de lo que todavía no está encendido va aparte: pesa menos que
    // el día y no debe demorarlo.
    try {
      const r = await fetch("/api/hotel/capacidades", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setCapacidades(d.capacidades);
    } catch {
      // la sección se omite si no se pudo medir
    }
  }, []);

  useEffect(() => {
    if (esHotel) cargar();
  }, [cargar, esHotel]);

  if (!esHotel) return <div className="flex-1 bg-surface" />;

  const simbolo = panel?.propiedad?.simbolo ?? "$";

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-5 py-3">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Hoy</h1>
          <p className="text-[12.5px] text-[var(--text-3)] first-letter:uppercase">
            {panel ? `${panel.propiedad?.nombre ?? ""} · ${fechaLarga(panel.hoy)}` : "Leyendo el sistema de reservas"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => cargar(true)}
          disabled={cargando}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-60"
        >
          <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
          Actualizar
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {error && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/10 px-4 py-3 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {cargando && !panel && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[112px] animate-pulse rounded-2xl border border-line bg-card" />
            ))}
          </div>
        )}

        {panel && (
          <>
            {panel.faltantes.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/10 px-3.5 py-2.5 text-[12.5px] text-[var(--text-2)]">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
                El sistema no respondió {listaEnPalabras(panel.faltantes)}. Lo que falta queda en
                blanco, no en cero.
              </p>
            )}

            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Numero Icon={LogIn} valor={panel.llegadas?.length} label="Llegadas" />
              <Numero Icon={LogOut} valor={panel.salidas?.length} label="Salidas" />
              <Numero Icon={Users} valor={panel.enCasa?.length} label="En casa" />
              <Numero
                Icon={DoorOpen}
                valor={panel.sinHabitacion?.length}
                label="Sin habitación asignada"
                alerta={(panel.sinHabitacion?.length ?? 0) > 0}
              />
            </div>

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <Tarjeta titulo="Entran hoy" Icon={LogIn}>
                <Movimientos
                  filas={panel.llegadas}
                  simbolo={simbolo}
                  vacio="Nadie tiene entrada para hoy."
                />
              </Tarjeta>
              <Tarjeta titulo="Salen hoy" Icon={LogOut}>
                <Movimientos
                  filas={panel.salidas}
                  simbolo={simbolo}
                  vacio="Nadie tiene salida para hoy."
                />
              </Tarjeta>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <Tarjeta titulo="En casa" Icon={Users}>
                {panel.enCasa === null ? (
                  <SinLectura />
                ) : panel.enCasa.length === 0 ? (
                  <Vacio texto="Ningún huésped con la entrada registrada." />
                ) : (
                  <ul className="space-y-2">
                    {panel.enCasa.map((h) => (
                      <li key={`${h.reservaId}-${h.huesped}`} className="rounded-xl border border-line bg-surface/60 p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-[13px] font-bold text-[var(--text)]">{h.huesped}</p>
                          {h.habitacion && (
                            <span className="text-[11.5px] font-semibold text-brand">{h.habitacion}</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                          {fechaCorta(h.desde)} al {fechaCorta(h.hasta)}
                          {h.telefono ? ` · ${h.telefono}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>

              <Tarjeta
                titulo={`Sin habitación asignada, próximos ${panel.ventana} días`}
                Icon={DoorOpen}
              >
                {panel.sinHabitacion === null ? (
                  <SinLectura />
                ) : panel.sinHabitacion.length === 0 ? (
                  <Vacio texto="Todas las reservas tienen su habitación puesta." />
                ) : (
                  <ul className="space-y-2">
                    {panel.sinHabitacion.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-xl border border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/[0.09] p-3"
                      >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-[13px] font-bold text-[var(--text)]">{m.huesped}</p>
                          <span className="text-[11px] font-semibold text-[var(--text-3)]">{m.id}</span>
                        </div>
                        <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                          {fechaCorta(m.desde)} al {fechaCorta(m.hasta)} ·{" "}
                          {m.tipos.join(", ") || "sin tipo cargado"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                {panel.libres !== null && panel.libres.length > 0 && (
                  <div className="mt-3 border-t border-line pt-2.5">
                    <p className="text-[12px] text-[var(--text-2)]">
                      <span className="font-bold text-[var(--text)]">{panel.libres.length}</span>{" "}
                      {panel.libres.length === 1 ? "habitación libre" : "habitaciones libres"} para
                      poner a alguien esta noche
                    </p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-3)]">
                      {panel.libres.map((h) => h.nombre).join(" · ")}
                    </p>
                  </div>
                )}
              </Tarjeta>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
              <Tarjeta titulo="Limpieza" Icon={SprayCan}>
                {panel.limpieza === null ? (
                  <SinLectura />
                ) : (
                  <>
                    <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-[var(--text-2)]">
                      <Cuenta label="Listas" valor={panel.limpieza.listas} />
                      <Cuenta label="Por limpiar" valor={panel.limpieza.porLimpiar} alerta />
                      <Cuenta label="Revisadas" valor={panel.limpieza.revisadas} />
                    </div>
                    {panel.limpieza.pendientes.length === 0 ? (
                      <Vacio
                        texto={`Las ${panel.limpieza.total} habitaciones están listas y sin nada anotado.`}
                      />
                    ) : (
                      <ul className="space-y-2">
                        {panel.limpieza.pendientes.map((h) => (
                          <li key={h.habitacionId} className="rounded-xl border border-line bg-surface/60 p-3">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-[13px] font-bold text-[var(--text)]">{h.habitacion}</p>
                              <span className="text-[11.5px] font-semibold text-[var(--brand-accent)]">
                                {CONDICION[h.condicion] ?? h.condicion}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                              {h.tipo}
                              {h.noMolestar ? " · no molestar" : ""}
                              {h.comentario ? ` · ${h.comentario}` : ""}
                            </p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </Tarjeta>

              <Tarjeta titulo="Fuera de servicio" Icon={Wrench}>
                {panel.bloqueos === null ? (
                  <SinLectura />
                ) : panel.bloqueos.length === 0 ? (
                  <Vacio texto="Ninguna habitación bloqueada en los próximos 30 días." />
                ) : (
                  <ul className="space-y-2">
                    {panel.bloqueos.map((b) => (
                      <li key={b.id} className="rounded-xl border border-line bg-surface/60 p-3">
                        <p className="text-[13px] font-bold text-[var(--text)]">{b.habitacion}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                          {fechaCorta(b.desde)} al {fechaCorta(b.hasta)}
                          {b.motivo ? ` · ${b.motivo}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Tarjeta>
            </div>

            <PorActivar capacidades={capacidades} />
          </>
        )}
      </div>
    </div>
  );
}

function listaEnPalabras(items: string[]): string {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} ni ${items[items.length - 1]}`;
}

function Numero({
  Icon,
  valor,
  label,
  alerta = false,
}: {
  Icon: LucideIcon;
  valor: number | undefined | null;
  label: string;
  alerta?: boolean;
}) {
  const sinLectura = valor === undefined || valor === null;
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm",
        alerta && !sinLectura ? "border-[var(--brand-accent)]/50" : "border-line",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          alerta && !sinLectura
            ? "bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]"
            : "bg-brand/10 text-brand",
        )}
      >
        <Icon size={18} />
      </span>
      {sinLectura ? (
        <p className="mt-3 text-[15px] font-bold leading-none tracking-tight text-[var(--text-3)]">
          Sin lectura
        </p>
      ) : (
        <p className="mt-3 text-[26px] font-extrabold leading-none tracking-tight text-[var(--text)]">
          {valor}
        </p>
      )}
      <p className="mt-1.5 text-[12.5px] font-medium text-[var(--text-3)]">{label}</p>
    </div>
  );
}

function Tarjeta({
  titulo,
  Icon,
  children,
}: {
  titulo: string;
  Icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
        <Icon size={15} className="text-brand" />
        {titulo}
      </h2>
      {children}
    </div>
  );
}

function Cuenta({ label, valor, alerta = false }: { label: string; valor: number; alerta?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span
        className={cn(
          "text-[15px] font-extrabold",
          alerta && valor > 0 ? "text-[var(--brand-accent)]" : "text-[var(--text)]",
        )}
      >
        {valor}
      </span>
      {label}
    </span>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <p className="rounded-xl border border-dashed border-[var(--border-2)] px-3.5 py-4 text-center text-[12.5px] text-[var(--text-2)]">
      {texto}
    </p>
  );
}

function SinLectura() {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-[var(--brand-accent)]/50 px-3.5 py-4 text-[12.5px] text-[var(--text-2)]">
      <AlertCircle size={15} className="shrink-0 text-[var(--brand-accent)]" />
      El sistema no respondió esta consulta.
    </p>
  );
}

function Movimientos({
  filas,
  simbolo,
  vacio,
}: {
  filas: Movimiento[] | null;
  simbolo: string;
  vacio: string;
}) {
  if (filas === null) return <SinLectura />;
  if (filas.length === 0) return <Vacio texto={vacio} />;
  return (
    <ul className="space-y-2">
      {filas.map((m) => (
        <li key={m.id} className="rounded-xl border border-line bg-surface/60 p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] font-bold text-[var(--text)]">{m.huesped}</p>
            <span className="text-[11px] font-semibold text-[var(--text-3)]">{m.id}</span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
            {m.habitaciones.join(", ") || m.tipos.join(", ") || "sin habitación"} ·{" "}
            {fechaCorta(m.desde)} al {fechaCorta(m.hasta)} · {m.adultos}{" "}
            {m.adultos === 1 ? "adulto" : "adultos"}
            {m.ninos > 0 ? ` y ${m.ninos} ${m.ninos === 1 ? "niño" : "niños"}` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-2)]">
              {m.fuente}
              {m.fuenteExterna ? " (portal)" : ""}
            </span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-2)]">
              {m.estado}
            </span>
            {m.saldo > 0 && (
              <span className="rounded-full bg-[var(--brand-accent)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--brand-accent)]">
                {dinero(m.saldo, simbolo)} pendiente
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ── Lo que todavía no está encendido ──
// Se distingue a simple vista de lo de arriba: sin tarjetas rellenas, todo con
// borde punteado y en gris. Y lo dice con todas las letras en el encabezado.
function PorActivar({ capacidades }: { capacidades: Capacidades | null }) {
  if (!capacidades) return null;
  const cobro = capacidades.cobro.map((c) => c.nombre).filter(Boolean);
  const dir = capacidades.direccion;

  const puntos: Array<{ Icon: LucideIcon; titulo: string; hoy: string; despues: string }> = [
    {
      Icon: CalendarPlus,
      titulo: "Reservar de verdad desde aquí",
      hoy: "La reserva que cierra el asistente se queda en este tablero. En el sistema del hotel no entra, así que la habitación se sigue ofreciendo en los portales de venta hasta que alguien la carga a mano.",
      despues:
        "La reserva entraría al sistema del hotel y desde ahí se propaga sola a los portales: la habitación deja de ofrecerse en todos lados a la vez.",
    },
    {
      Icon: Tag,
      titulo: "Ponerle precio a las habitaciones que hoy nadie puede reservar",
      hoy:
        capacidades.tipos > 0
          ? `De las ${capacidades.tipos} habitaciones cargadas, ${capacidades.sinTarifa} no tienen tarifa. Sin tarifa el sistema no las ofrece: no se pueden reservar por ningún canal, ni por los portales ni por WhatsApp.`
          : "No se pudo medir cuántas habitaciones están a la venta.",
      despues: "Se les pondría precio desde este tablero, sin entrar al otro sistema.",
    },
    {
      Icon: CircleDollarSign,
      titulo: "Cobrar",
      hoy: `El cobro se hace por fuera y el pago se anota a mano.${
        cobro.length > 0 ? ` La cuenta tiene ${cobro.join(" y ")} como forma de pago` : " La cuenta no tiene formas de pago cargadas"
      }, pero sin una pasarela de cobro conectada, así que el sistema no puede cobrar en línea.`,
      despues:
        "Con una pasarela conectada, el anticipo o el saldo se cobrarían desde aquí y el pago quedaría registrado en la reserva.",
    },
    {
      Icon: NotebookPen,
      titulo: "Que lo que anota recepción también se vea en el sistema del hotel",
      hoy: "Las notas del sistema se leen en la ficha del huésped, pero lo que se escribe en este tablero se queda en este tablero.",
      despues:
        "La preferencia que anota recepción quedaría también en la ficha del huésped del sistema del hotel, para quien la abra desde allá.",
    },
  ];

  return (
    <section className="rounded-2xl border border-dashed border-[var(--border-2)] bg-surface/40 p-5">
      <h2 className="text-sm font-bold text-[var(--text-2)]">
        Nada de esta sección está encendido
      </h2>
      <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-3)]">
        Es hasta dónde podría llegar el tablero sobre el mismo sistema que el hotel ya paga, medido
        contra su cuenta. Ninguna de estas cosas funciona hoy ni queda comprometida por aparecer
        aquí.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {puntos.map((p) => (
          <div key={p.titulo} className="rounded-xl border border-dashed border-[var(--border-2)] p-4">
            <h3 className="flex items-center gap-2 text-[13px] font-bold text-[var(--text-2)]">
              <p.Icon size={15} className="text-[var(--text-3)]" />
              {p.titulo}
            </h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--text-2)]">{p.hoy}</p>
            <p className="mt-2 border-t border-dashed border-[var(--border-2)] pt-2 text-[12.5px] leading-relaxed text-[var(--text-3)]">
              {p.despues}
            </p>
          </div>
        ))}
      </div>

      {dir && (
        <p className="mt-3 text-[11.5px] text-[var(--text-3)]">
          Cuando se abra la reserva real, el país y el código postal saldrían de la ficha del
          alojamiento ({[dir.pais, dir.zip, dir.ciudad].filter(Boolean).join(" · ")}), no se le
          preguntan al huésped.
        </p>
      )}
    </section>
  );
}
