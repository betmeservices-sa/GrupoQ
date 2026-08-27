"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BedDouble,
  CalendarCheck,
  Check,
  CircleDollarSign,
  Copy,
  Globe,
  Inbox,
  Instagram,
  Facebook,
  MousePointerClick,
  LogIn,
  LogOut,
  Loader2,
  MessageSquare,
  RefreshCw,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useStore } from "@/lib/store";
import { staff } from "@/lib/data/seed";
import type { Conversation } from "@/lib/data/types";
import { activeTenant } from "@/lib/tenants/active";
import { urlDeEnlace } from "@/lib/enlaces";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { OrigenCanales } from "@/components/dashboard/OrigenCanales";
import { DeptBreakdown } from "@/components/dashboard/DeptBreakdown";
import { MensajesRedes } from "@/components/dashboard/MensajesRedes";
import { ReservasPorConfirmar } from "@/components/yali/Apartados";
import { NuevaReserva } from "@/components/yali/NuevaReserva";

// Espejo de los tipos de lib/yali-pms.ts. Se declaran acá porque el panel habla
// con /api/yali/panel y no importa nada del servidor.
interface FilaOcupacion {
  id: string;
  nombre: string;
  unidades: number;
  tarifaNoche: number;
  ocupadasPorNoche: number[];
}
interface RepartoCanal {
  canal: string;
  reservas: number;
  ingreso: number;
  pct: number;
}
interface Reserva {
  id: string;
  sedeId: string;
  sedeNombre: string;
  habitacionNombre: string;
  huesped: string;
  desde: string;
  hasta: string;
  huespedes: number;
  total: number;
  canal: string;
  origen: "demo" | "agente" | "pms";
}
interface PanelSede {
  id: string;
  nombre: string;
  ubicacion: string;
  unidades: number;
  ocupadasHoy: number;
  ocupacionHoyPct: number;
  llegadasHoy: number;
  salidasHoy: number;
  huespedesEnCasa: number;
  ingresoVentana: number;
  reservasVentana: number;
  nochesVendidas: number;
  tarifaMedia: number;
  filas: FilaOcupacion[];
  porCanal: RepartoCanal[];
  llegadas: Reserva[];
}
interface Panel {
  hoy: string;
  dias: number;
  fechas: string[];
  moneda: string;
  tarifasConfirmadas: boolean;
  sedesDemo: string[];
  sedes: PanelSede[];
  kpis: {
    unidades: number;
    ocupadasHoy: number;
    ocupacionHoyPct: number;
    llegadasHoy: number;
    salidasHoy: number;
    huespedesEnCasa: number;
    reservasVentana: number;
    reservasDelAgente: number;
    ingresoVentana: number;
    tarifaMedia: number;
    nochesVendidas: number;
    nochesVendibles: number;
  };
  porCanal: RepartoCanal[];
  llegadas: Reserva[];
  consultado: string;
}

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function partes(fecha: string): { dia: number; finde: boolean } {
  const [a, m, d] = fecha.split("-").map(Number);
  const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return { dia: d, finde: dow === 0 || dow === 6 };
}

function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

function dinero(v: number): string {
  return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function YaliDashboard() {
  const { state } = useStore();
  const [panel, setPanel] = useState<Panel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  // "general" = los tres hoteles juntos; si no, el id de la sede abierta.
  const [tab, setTab] = useState<string>("general");
  const [reservando, setReservando] = useState(false);

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const r = await fetch("/api/yali/panel", { cache: "no-store" });
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

  const sedeAbierta = panel?.sedes.find((s) => s.id === tab) ?? null;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-5 pt-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Dashboard</h1>
            <p className="text-[12.5px] text-[var(--text-3)]">
              {sedeAbierta
                ? `${sedeAbierta.nombre} · ${sedeAbierta.ubicacion}`
                : "Los tres hoteles, ocupación y conversaciones"}
            </p>
          </div>
          <div className="mb-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReservando(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white transition hover:opacity-90"
            >
              <BedDouble size={13} />
              Nueva reserva
            </button>
            <button
              type="button"
              onClick={() => cargar(true)}
              disabled={cargando}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-60"
            >
              <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
              Actualizar
            </button>
          </div>
          {reservando && (
            <NuevaReserva sedeInicial={tab === "general" ? undefined : tab} onCerrar={() => setReservando(false)} onCreada={() => void cargar(true)} />
          )}
        </div>

        <nav className="-mb-px mt-3 flex gap-1 overflow-x-auto">
          <Tab activa={tab === "general"} onClick={() => setTab("general")}>
            Vista general
          </Tab>
          {(panel?.sedes ?? []).map((s) => (
            <Tab key={s.id} activa={tab === s.id} onClick={() => setTab(s.id)}>
              {s.nombre.split(",")[0]}
            </Tab>
          ))}
        </nav>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        {cargando && !panel && (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-card p-5 text-[13px] text-[var(--text-2)]">
            <Loader2 size={15} className="animate-spin text-brand" />
            Leyendo ocupación, reservas y tarifas
          </div>
        )}

        {!cargando && !panel && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-[var(--brand-accent)]/40 bg-[var(--brand-accent)]/10 p-4 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error ?? "Sin datos de ocupación."}</p>
          </div>
        )}

        {panel && !panel.tarifasConfirmadas && (
          <p className="flex items-start gap-2 rounded-xl border border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-[var(--text-2)]">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
            {panel.sedesDemo.length >= panel.sedes.length
              ? "Las tarifas y la ocupación son de demostración mientras se conecta el sistema de reservas del hotel. El agente cotiza con ellas y avisa que el equipo confirma el precio final."
              : `${panel.sedesDemo.join(" y ")} sigue con cifras de demostración hasta conectar su Cloudbeds; el resto ya es real.`}
          </p>
        )}

        {panel && !sedeAbierta && <VistaGeneral panel={panel} conversaciones={state.conversations} />}
        {panel && sedeAbierta && (
          <VistaSede
            sede={sedeAbierta}
            panel={panel}
            conversaciones={state.conversations.filter((c) => c.sucursalId === sedeAbierta.id)}
          />
        )}
      </div>
    </div>
  );
}

function Tab({
  activa,
  onClick,
  children,
}: {
  activa: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 border-b-2 px-3.5 py-2.5 text-[13px] font-bold transition",
        activa
          ? "border-brand text-brand"
          : "border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]",
      )}
    >
      {children}
    </button>
  );
}

// ───────────────────────────── vista general ─────────────────────────────

function VistaGeneral({
  panel,
  conversaciones,
}: {
  panel: Panel;
  conversaciones: Conversation[];
}) {
  const k = panel.kpis;
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label={`Ocupación hoy · ${k.ocupadasHoy} de ${k.unidades}`} valor={`${k.ocupacionHoyPct}%`} Icon={BedDouble} />
        <MetricCard label="Huéspedes en casa" valor={k.huespedesEnCasa} Icon={Users} />
        <MetricCard label={`Llegadas hoy · ${k.salidasHoy} salidas`} valor={k.llegadasHoy} Icon={LogIn} />
        <MetricCard label={`Reservado a ${panel.dias} días · ${k.reservasVentana} reservas`} valor={dinero(k.ingresoVentana)} Icon={CircleDollarSign} />
        <MetricCard label="Tarifa media por noche vendida" valor={dinero(k.tarifaMedia)} Icon={CalendarCheck} />
        <MetricCard label="Reservas entradas por WhatsApp" valor={k.reservasDelAgente} Icon={MessageSquare} />
      </div>

      {/* Lo que Sofía apartó y espera que una persona verifique el pago. */}
      <ReservasPorConfirmar />

      <Sedes panel={panel} />

      {/* Lo que entra por Messenger e Instagram y de qué hablan. */}
      <MensajesRedes />

      <OrigenCanales conversations={conversaciones} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Llegadas titulo="Próximas llegadas" reservas={panel.llegadas} conSede />
        <PorCanal reparto={panel.porCanal} dias={panel.dias} />
      </div>

      <DeptBreakdown conversations={conversaciones} />
    </>
  );
}

function Sedes({ panel }: { panel: Panel }) {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {panel.sedes.map((sede) => (
        <div key={sede.id} className="rounded-2xl border border-line bg-card p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-[var(--text)]">
                {sede.nombre.split(",")[0]}
              </h3>
              <p className="truncate text-[11.5px] text-[var(--text-3)]">{sede.ubicacion}</p>
            </div>
            <p className="shrink-0 text-[22px] font-extrabold leading-none text-brand">
              {sede.ocupacionHoyPct}%
            </p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
            <div className="h-full rounded-full bg-brand" style={{ width: `${sede.ocupacionHoyPct}%` }} />
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-2)]">
            <span className="inline-flex items-center gap-1">
              <LogIn size={12} className="text-brand" />
              {sede.llegadasHoy} llegan
            </span>
            <span className="inline-flex items-center gap-1">
              <LogOut size={12} className="text-[var(--brand-accent)]" />
              {sede.salidasHoy} salen
            </span>
            <span className="ml-auto font-semibold text-[var(--text)]">
              {dinero(sede.ingresoVentana)}
            </span>
          </p>
          <Franja fechas={panel.fechas} filas={sede.filas} />
          <p className="mt-2 text-[10.5px] leading-snug text-[var(--text-3)]">
            Próximas {panel.dias} noches por tipo de habitación: cada cuadro es una noche y el número,
            cuántas de esas habitaciones están ocupadas. Más oscuro, más lleno.
          </p>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────── vista de una sede ─────────────────────────────

function VistaSede({
  sede,
  panel,
  conversaciones,
}: {
  sede: PanelSede;
  panel: Panel;
  conversaciones: Conversation[];
}) {
  const abiertas = conversaciones.filter((c) => c.estado !== "resuelto").length;
  const sinAsignar = conversaciones.filter((c) => !c.asignadoA).length;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard label={`Ocupación hoy · ${sede.ocupadasHoy} de ${sede.unidades}`} valor={`${sede.ocupacionHoyPct}%`} Icon={BedDouble} />
        <MetricCard label="Huéspedes en casa" valor={sede.huespedesEnCasa} Icon={Users} />
        <MetricCard label={`Llegadas hoy · ${sede.salidasHoy} salidas`} valor={sede.llegadasHoy} Icon={LogIn} />
        <MetricCard label={`Reservado a ${panel.dias} días · ${sede.reservasVentana} reservas`} valor={dinero(sede.ingresoVentana)} Icon={CircleDollarSign} />
        <MetricCard label="Tarifa media por noche vendida" valor={dinero(sede.tarifaMedia)} Icon={CalendarCheck} />
        <MetricCard label={`Conversaciones abiertas · ${sinAsignar} sin asignar`} valor={abiertas} Icon={Inbox} />
      </div>

      <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[var(--text)]">Ocupación por habitación</h3>
        <p className="mb-1 text-[12px] text-[var(--text-3)]">
          Próximas {panel.dias} noches. Cuanto más oscuro, más lleno.
        </p>
        <Franja fechas={panel.fechas} filas={sede.filas} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Llegadas titulo={`Próximas llegadas a ${sede.nombre.split(",")[0]}`} reservas={sede.llegadas} />
        <div className="space-y-5">
          <PorCanal reparto={sede.porCanal} dias={panel.dias} />
          <Origenes sedeId={sede.id} />
        </div>
      </div>

      <Conversaciones sede={sede} conversaciones={conversaciones} />
    </>
  );
}

interface EnlaceMedido {
  codigo: string;
  sedeId: string;
  canal: string;
  frase: string;
  utm: { source: string; medium: string; campaign: string };
  clics: number;
  ultimoClic: string | null;
  campanas: string[];
  conversaciones: number;
}

const ICONO_CANAL: Record<string, LucideIcon> = {
  Instagram,
  Facebook,
  "Sitio web": Globe,
};

// De dónde llegan los que escriben a ESTA sede.
//
// Los tres perfiles escriben al mismo WhatsApp y un wa.me pelado no deja rastro:
// no viaja ningún UTM. Por eso en la bio va un link nuestro que cuenta el clic y
// recién después manda a WhatsApp con el mensaje escrito. Acá se ven las dos
// puntas: cuántos tocaron y cuántos escribieron.
function Origenes({ sedeId }: { sedeId: string }) {
  const [enlaces, setEnlaces] = useState<EnlaceMedido[] | null>(null);
  const [dias, setDias] = useState(30);
  const [base, setBase] = useState("");

  useEffect(() => {
    setBase(window.location.origin);
  }, []);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/yali/origenes?dias=${dias}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (vivo && d.ok) setEnlaces(d.enlaces as EnlaceMedido[]);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [dias]);

  const mios = (enlaces ?? []).filter((e) => e.sedeId === sedeId);
  const totalClics = mios.reduce((n, e) => n + e.clics, 0);

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[var(--text)]">De dónde llegan los que escriben</h3>
          <p className="text-[12px] text-[var(--text-3)]">
            Un link por perfil. Cuenta el clic y deja el mensaje escrito.
          </p>
        </div>
        <select
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
          className="rounded-lg border border-line bg-surface px-2 py-1 text-[12px] font-semibold text-[var(--text-2)] outline-none"
        >
          <option value={7}>7 días</option>
          <option value={30}>30 días</option>
          <option value={90}>90 días</option>
        </select>
      </div>

      <div className="mt-4 space-y-3">
        {mios.map((e) => (
          <Enlace key={e.codigo} enlace={e} base={base} />
        ))}
      </div>

      {enlaces !== null && totalClics === 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface/70 px-3.5 py-2.5 text-[12px] leading-relaxed text-[var(--text-2)]">
          <MousePointerClick size={14} className="mt-0.5 shrink-0 text-brand" />
          Todavía sin clics. Empieza a contar en cuanto pongas estos links en la bio de cada
          perfil, en lugar del número de WhatsApp suelto.
        </p>
      )}
    </div>
  );
}

function Enlace({ enlace, base }: { enlace: EnlaceMedido; base: string }) {
  const [copiado, setCopiado] = useState(false);
  const Icon = ICONO_CANAL[enlace.canal] ?? Globe;
  const url = base ? urlDeEnlace(base, enlace) : `/ir/${enlace.codigo}`;
  const pct = enlace.clics === 0 ? null : Math.round((enlace.conversaciones / enlace.clics) * 100);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface/50 p-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[var(--text)]">
          <Icon size={14} className="text-brand" />
          {enlace.canal}
        </span>
        <span className="text-[12px] text-[var(--text-3)]">
          {enlace.clics} {enlace.clics === 1 ? "clic" : "clics"} · {enlace.conversaciones}{" "}
          {enlace.conversaciones === 1 ? "escribió" : "escribieron"}
          {pct !== null ? ` · ${pct}%` : ""}
        </span>
        <button
          type="button"
          onClick={copiar}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[11.5px] font-bold text-[var(--text-2)] transition hover:bg-surface"
        >
          {copiado ? <Check size={12} /> : <Copy size={12} />}
          {copiado ? "Copiado" : "Copiar link"}
        </button>
      </div>
      <code className="mt-2 block truncate rounded-lg bg-card px-2.5 py-1.5 text-[11px] text-[var(--text-3)]">
        {url}
      </code>
      <p className="mt-1.5 text-[11.5px] italic text-[var(--text-2)]">
        Deja escrito: &quot;{enlace.frase}&quot;
      </p>
    </div>
  );
}

function Conversaciones({
  sede,
  conversaciones,
}: {
  sede: PanelSede;
  conversaciones: Conversation[];
}) {
  const { state } = useStore();
  const nombreDe = (contactId: string) =>
    state.contacts.find((c) => c.id === contactId)?.nombre ?? "Contacto";

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[var(--text)]">
        Conversaciones de {sede.nombre.split(",")[0]}
      </h3>
      <p className="mb-3 text-[12px] text-[var(--text-3)]">
        Solo los chats de este hotel, con quien los está atendiendo.
      </p>
      {conversaciones.length === 0 ? (
        <p className="text-[12.5px] text-[var(--text-2)]">
          Todavía no hay conversaciones asignadas a este hotel.
        </p>
      ) : (
        <ul className="space-y-2">
          {conversaciones.map((c) => {
            const quien = staff.find((s) => s.id === c.asignadoA);
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface/60 px-3.5 py-2.5"
              >
                <span className="text-[13px] font-bold text-[var(--text)]">
                  {nombreDe(c.contactId)}
                </span>
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold capitalize text-[var(--text-2)]">
                  {c.canal}
                </span>
                <span className="text-[12px] text-[var(--text-3)]">
                  {quien ? quien.nombre : "sin asignar, lo lleva el agente"}
                </span>
                {c.noLeidos > 0 && (
                  <span className="ml-auto rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
                    {c.noLeidos}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────────── piezas compartidas ─────────────────────────────

function Franja({ fechas, filas }: { fechas: string[]; filas: FilaOcupacion[] }) {
  const cabeceras = useMemo(() => fechas.map(partes), [fechas]);
  return (
    <div className="mt-4 space-y-1.5">
      <div className="flex gap-[3px] pl-[92px] text-[9px] text-[var(--text-3)]">
        {cabeceras.map((c, i) => (
          <span key={fechas[i]} className={cn("flex-1 text-center", c.finde && "font-bold text-brand")}>
            {c.dia}
          </span>
        ))}
      </div>
      {filas.map((f) => (
        <div key={f.id} className="flex items-center gap-[3px]">
          <span
            title={`${f.nombre} · ${f.unidades} unidades · ${dinero(f.tarifaNoche)} la noche`}
            className="w-[89px] shrink-0 truncate text-[11px] font-medium text-[var(--text-2)]"
          >
            {f.nombre}
          </span>
          {f.ocupadasPorNoche.map((ocupadas, i) => {
            const pct = f.unidades === 0 ? 0 : ocupadas / f.unidades;
            return (
              <span
                key={fechas[i]}
                title={`${f.nombre} · ${fechaCorta(fechas[i])}: ${ocupadas} de ${f.unidades} ocupadas`}
                className="relative h-5 flex-1 rounded-[3px] ring-1 ring-inset ring-[var(--border-2)]"
              >
                {/* El color va aparte del número: si la opacidad fuera del span
                    entero, el número se desvanecería con el cuadro. */}
                <span
                  className="absolute inset-0 rounded-[3px] bg-brand"
                  style={{ opacity: pct === 0 ? 0.08 : 0.25 + pct * 0.75 }}
                />
                {ocupadas > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold leading-none text-white">
                    {ocupadas}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function Llegadas({
  titulo,
  reservas,
  conSede = false,
}: {
  titulo: string;
  reservas: Reserva[];
  conSede?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[var(--text)]">{titulo}</h3>
      <p className="mb-3 text-[12px] text-[var(--text-3)]">
        Quién entra, en qué habitación y por dónde reservó.
      </p>
      {reservas.length === 0 ? (
        <p className="text-[12.5px] text-[var(--text-2)]">No hay llegadas en la ventana.</p>
      ) : (
        <ul className="space-y-2">
          {reservas.map((r) => (
            <li
              key={r.id}
              className={cn(
                "rounded-xl border p-3",
                r.origen === "agente" ? "border-brand/45 bg-brand/[0.06]" : "border-line bg-surface/60",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[13px] font-bold text-[var(--text)]">{r.huesped}</p>
                <span className="text-[11px] font-semibold text-[var(--text-3)]">{r.id}</span>
              </div>
              <p className="mt-0.5 text-[12px] text-[var(--text-2)]">
                {conSede ? `${r.sedeNombre.split(",")[0]} · ` : ""}
                {r.habitacionNombre} · {fechaCorta(r.desde)} al {fechaCorta(r.hasta)} ·{" "}
                {r.huespedes} {r.huespedes === 1 ? "huésped" : "huéspedes"}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-[var(--text-2)]">
                  {r.canal}
                </span>
                <span className="text-[12px] font-bold text-[var(--text)]">{dinero(r.total)}</span>
                {r.origen === "agente" && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-bold text-brand">
                    <MessageSquare size={11} />
                    la cerró Sofía
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PorCanal({ reparto, dias }: { reparto: RepartoCanal[]; dias: number }) {
  const max = Math.max(1, ...reparto.map((c) => c.reservas));
  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[var(--text)]">Por dónde entran las reservas</h3>
      <p className="mb-4 text-[12px] text-[var(--text-3)]">
        Reservas e ingreso de las próximas {dias} noches.
      </p>
      <div className="space-y-3">
        {reparto.map((c) => (
          <div key={c.canal} className="flex items-center gap-3">
            <span className="w-20 shrink-0 truncate text-[12.5px] font-medium text-[var(--text-2)]">
              {c.canal}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
              <div
                className={cn(
                  "h-full rounded-full",
                  c.canal === "WhatsApp" ? "bg-brand" : "bg-[var(--brand-accent)]/70",
                )}
                style={{ width: `${(c.reservas / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-[12.5px] font-bold text-[var(--text)]">
              {c.reservas}
            </span>
            <span className="w-16 shrink-0 text-right text-[12px] text-[var(--text-3)]">
              {dinero(c.ingreso)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
