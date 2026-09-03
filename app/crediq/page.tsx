"use client";

// Pipeline de ventas de CrediQ, la financiera de Grupo Q.
//
// Dos vistas de lo mismo: el TABLERO, donde se trabaja caso por caso, y la
// REPORTERÍA del gerente, que es la que dice a quién hay que ir a mover.
//
// La columna en la que cae cada quien NO se elige a mano: sale del expediente
// (qué documento entregó, cuál está devuelto) y de las marcas de tiempo. Por eso
// las tarjetas no se arrastran: se marca el documento en la ficha y el caso se
// mueve solo. Cuando el expediente queda completo, el sistema se lo pasa al
// vendedor con menos carga y arranca el reloj de 48 horas.

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, GitBranch, Loader2, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { telefonoBonito } from "@/lib/phone";
import { PERIODOS, type Periodo } from "@/lib/periodos";
import { ETAPAS, HORAS_AVISO, NOMBRE_SUB, type EtapaId, type SubEstado } from "@/lib/ventas-pipeline";
import { FichaCaso } from "@/components/ventas/FichaCaso";
import { ReporteGerente } from "@/components/ventas/ReporteGerente";
import type { Caso, EventoCaso, RespuestaReporte, RespuestaTablero } from "@/components/ventas/tipos";

const COLOR_SUB: Record<SubEstado, string> = {
  sin_entregar: "bg-surface text-[var(--text-3)]",
  parcial: "bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]",
  con_observacion: "bg-[var(--brand-red)]/10 text-[var(--brand-red)]",
  en_revision: "bg-amber-50 text-amber-700",
};

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase() || "?";
}

function hace(iso: string | null): string {
  if (!iso) return "";
  const h = (Date.now() - Date.parse(iso)) / 3_600_000;
  if (h < 1) return `hace ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `hace ${Math.round(h)} h`;
  return `hace ${Math.round(h / 24)} días`;
}

export default function CrediqPage() {
  const [vista, setVista] = useState<"tablero" | "reporte">("tablero");
  const [datos, setDatos] = useState<RespuestaTablero | null>(null);
  const [reporte, setReporte] = useState<RespuestaReporte | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("7d");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [eventos, setEventos] = useState<EventoCaso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/ventas/solicitudes", { cache: "no-store" });
      const d = (await r.json()) as RespuestaTablero;
      if (d.ok) {
        setDatos(d);
        setError(null);
      } else setError(d.error ?? "No se pudo leer el embudo.");
    } catch {
      setError("No se pudo leer el embudo.");
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarReporte = useCallback(async () => {
    const r = await fetch(`/api/ventas/reporte?periodo=${periodo}`, { cache: "no-store" });
    const d = (await r.json()) as RespuestaReporte;
    if (d.ok) setReporte(d);
  }, [periodo]);

  const cargarCaso = useCallback(async (telefono: string) => {
    const r = await fetch(`/api/ventas/solicitudes?telefono=${telefono}`, { cache: "no-store" });
    const d = (await r.json()) as { ok: boolean; caso?: Caso; eventos?: EventoCaso[] };
    if (d.ok && d.caso) {
      setEventos(d.eventos ?? []);
      setDatos((prev) =>
        prev ? { ...prev, solicitudes: prev.solicitudes.map((s) => (s.telefono === telefono ? d.caso! : s)) } : prev,
      );
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    if (vista === "reporte") void cargarReporte();
  }, [vista, cargarReporte]);

  useEffect(() => {
    if (seleccion) void cargarCaso(seleccion);
  }, [seleccion, cargarCaso]);

  async function accion(cuerpo: Record<string, unknown>) {
    if (!seleccion) return;
    setOcupado(true);
    try {
      const r = await fetch("/api/ventas/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cuerpo, telefono: seleccion }),
      });
      const d = (await r.json()) as { ok: boolean; caso?: Caso; error?: string };
      if (!d.ok) {
        setError(d.error ?? "No se pudo mover el caso.");
        return;
      }
      if (d.caso) {
        setDatos((prev) =>
          prev ? { ...prev, solicitudes: prev.solicitudes.map((s) => (s.telefono === seleccion ? d.caso! : s)) } : prev,
        );
      }
      await cargarCaso(seleccion);
      if (vista === "reporte") await cargarReporte();
    } finally {
      setOcupado(false);
    }
  }

  const solicitudes = datos?.solicitudes ?? [];
  const alertaPor = useMemo(
    () => new Map((datos?.alertas ?? []).map((a) => [a.telefono, a])),
    [datos?.alertas],
  );

  const columnas = useMemo(() => {
    const term = busqueda.trim().toLowerCase();
    const filtradas = solicitudes.filter(
      (s) => !term || [s.nombre, s.telefono, s.vehiculo ?? ""].join(" ").toLowerCase().includes(term),
    );
    return ETAPAS.map((e) => ({
      etapa: e,
      casos: filtradas
        .filter((s) => s.etapa === e.id)
        .sort((a, b) => b.actualizado.localeCompare(a.actualizado)),
    }));
  }, [solicitudes, busqueda]);

  const caso = solicitudes.find((s) => s.telefono === seleccion) ?? null;
  const enEmbudo = solicitudes.filter((s) => !s.cerrado).length;
  const alertas = datos?.alertas.length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-4 pt-3 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight text-[var(--text)]">
              <GitBranch size={18} className="text-brand" />
              Pipeline de ventas
            </h1>
            <p className="text-[12.5px] text-[var(--text-3)]">
              {cargando && !datos
                ? "Cargando el embudo"
                : `${enEmbudo} en el embudo${alertas > 0 ? ` · ${alertas} sin tomar a tiempo` : ""}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {vista === "tablero" && (
              <div className="relative">
                <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar nombre, teléfono o vehículo"
                  className="w-64 rounded-lg border border-line bg-card py-1.5 pl-7 pr-2 text-[12.5px] text-[var(--text)] outline-none"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                void cargar();
                if (vista === "reporte") void cargarReporte();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface"
            >
              <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
              Actualizar
            </button>
          </div>
        </div>

        <nav className="mt-2 flex gap-1">
          {([
            ["tablero", "Tablero", GitBranch],
            ["reporte", "Reportería", BarChart3],
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setVista(id)}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2 text-[13px] font-semibold transition",
                vista === id ? "border-brand text-brand" : "border-transparent text-[var(--text-3)] hover:text-[var(--text)]",
              )}
            >
              <Icon size={14} />
              {label}
              {id === "reporte" && alertas > 0 && (
                <span className="rounded-full bg-[var(--brand-red)] px-1.5 text-[10.5px] font-bold text-white">{alertas}</span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {error && (
        <p className="mx-4 mt-3 rounded-xl border border-[var(--brand-red)]/40 bg-[var(--brand-red)]/10 px-3 py-2 text-[12.5px] md:mx-6">
          {error}
        </p>
      )}

      {vista === "tablero" ? (
        <div className="flex min-h-0 flex-1">
          <div className="flex flex-1 gap-3 overflow-x-auto p-4 md:p-6">
            {cargando && !datos && (
              <p className="flex items-center gap-2 text-[13px] text-[var(--text-3)]">
                <Loader2 size={15} className="animate-spin text-brand" /> Cargando prospectos
              </p>
            )}
            {columnas.map(({ etapa, casos }) => (
              <section key={etapa.id} className="flex w-64 shrink-0 flex-col rounded-xl border border-line bg-surface/60">
                <header className="border-b border-line px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-[12px] font-bold text-[var(--text)]">{etapa.nombre}</h2>
                    <span className="rounded-full bg-card px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-3)]">
                      {casos.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-tight text-[var(--text-3)]">{etapa.ayuda}</p>
                </header>

                <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
                  {casos.length === 0 && <p className="px-1 py-3 text-center text-[10px] text-[var(--text-3)]">Sin nadie</p>}
                  {casos.map((s) => (
                    <Tarjeta
                      key={s.telefono}
                      caso={s}
                      alerta={alertaPor.get(s.telefono)?.nivel ?? null}
                      vendedor={datos?.vendedores.find((v) => v.id === s.vendedor)?.nombre ?? null}
                      activo={s.telefono === seleccion}
                      onClick={() => setSeleccion(s.telefono === seleccion ? null : s.telefono)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>

          {caso && (
            <FichaCaso
              caso={caso}
              eventos={eventos}
              vendedores={datos?.vendedores ?? []}
              ocupado={ocupado}
              onAccion={(cuerpo) => void accion(cuerpo)}
              onCerrar={() => setSeleccion(null)}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1">
              {PERIODOS.filter((p) => p.clave !== "rango").map((p) => (
                <button
                  key={p.clave}
                  type="button"
                  onClick={() => setPeriodo(p.clave)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition",
                    periodo === p.clave ? "bg-brand text-white shadow-sm" : "text-[var(--text-2)] hover:bg-card",
                  )}
                >
                  {p.etiqueta}
                </button>
              ))}
            </div>
            {reporte?.gerente && (
              <span className="ml-auto text-[12px] text-[var(--text-3)]">
                Gerente de ventas: {reporte.gerente.nombre} · los avisos de {HORAS_AVISO} h le llegan como ticket
              </span>
            )}
          </div>
          {reporte ? (
            <ReporteGerente r={reporte} />
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-[var(--text-3)]">
              <Loader2 size={15} className="animate-spin text-brand" /> Armando el reporte
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Tarjeta({
  caso,
  alerta,
  vendedor,
  activo,
  onClick,
}: {
  caso: Caso;
  alerta: "aviso" | "vencido" | null;
  vendedor: string | null;
  activo: boolean;
  onClick: () => void;
}) {
  const nombre = caso.nombre || telefonoBonito(caso.telefono);
  const enDocs: EtapaId[] = ["documentacion"];
  return (
    <article
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border bg-card p-2.5 transition",
        activo ? "border-brand ring-1 ring-brand/30" : "border-line hover:border-brand/40",
        alerta === "vencido" && "border-[var(--brand-red)]/60",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">
          {iniciales(nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-semibold text-[var(--text)]">{nombre}</p>
          <p className="truncate text-[11px] text-[var(--text-3)]">
            {caso.vehiculo ?? telefonoBonito(caso.telefono)} · {hace(caso.actualizado)}
          </p>
        </div>
      </div>

      {enDocs.includes(caso.etapa) && (
        <>
          <span className={cn("mt-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold", COLOR_SUB[caso.doc.sub])}>
            {NOMBRE_SUB[caso.doc.sub]}
          </span>
          <p className="mt-1 text-[10.5px] leading-tight text-[var(--text-3)]">{caso.doc.resumen}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
              <span
                className="block h-full rounded-full bg-brand/70"
                style={{ width: `${(caso.doc.aprobados / caso.doc.total) * 100}%` }}
              />
            </span>
            <span className="text-[10px] font-semibold text-[var(--text-3)]">
              {caso.doc.aprobados}/{caso.doc.total}
            </span>
          </div>
        </>
      )}

      {vendedor && <p className="mt-1.5 text-[10.5px] text-[var(--text-2)]">{vendedor}</p>}

      {alerta && (
        <p
          className={cn(
            "mt-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
            alerta === "vencido" ? "bg-[var(--brand-red)]/15 text-[var(--brand-red)]" : "bg-amber-50 text-amber-700",
          )}
        >
          <AlertTriangle size={10} />
          {alerta === "vencido" ? "Vencido, hay que reasignar" : `Sin tomar en ${HORAS_AVISO} h`}
        </p>
      )}

      {caso.etapa === "cerrado" && (
        <p className="mt-1.5 text-[10.5px] font-semibold text-[var(--text-2)]">
          {caso.resultado === "venta" ? "Venta" : `Perdido${caso.motivoCierre ? ` · ${caso.motivoCierre}` : ""}`}
        </p>
      )}
    </article>
  );
}
