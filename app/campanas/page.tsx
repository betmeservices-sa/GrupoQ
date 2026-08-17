"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Download,
  Pause,
  Play,
  Plus,
  Square,
  Upload,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";
import { dinero, dineroCorto, fechaHora, telefonoSv } from "@/lib/cobros-formato";
import {
  CAMPANA_ESTADO_NOMBRE,
  RESULTADO_NOMBRE,
  TRAMO_NOMBRE,
  type CampanaResumen,
  type ItemCampana,
  type TramoMora,
  type VentanaLlamado,
} from "@/lib/cobros-tipos";

const CAMPO =
  "w-full rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-[var(--text)] outline-none transition focus:border-brand";

const TRAMOS: Array<TramoMora | "todos"> = ["todos", "1_30", "31_60", "61_90", "90_mas"];
const DIAS = ["D", "L", "M", "M", "J", "V", "S"];

interface Numero {
  id: string;
  numero: string;
  nombre: string;
}

interface Vista {
  campanas: CampanaResumen[];
  numeros: Numero[];
  concurrenciaMax: number;
  ventanaPorDefecto: VentanaLlamado;
  hayTelefonia: boolean;
}

interface Detalle {
  campana: CampanaResumen;
  enVentana: boolean;
  motivo: string | null;
  restante: { minutos: number; humano: string };
  total: number;
  items: ItemCampana[];
}

interface Preview {
  aceptadas: number;
  rechazadas: number;
  duplicadas: number;
  total: number;
  columnasIgnoradas: string[];
}

const ESTADO_ITEM: Record<ItemCampana["estado"], { texto: string; clase: string }> = {
  pendiente: { texto: "En cola", clase: "bg-[var(--surface-2)] text-[var(--text-2)]" },
  marcando: { texto: "Marcando", clase: "bg-[#eef7e6] text-[#3f6b18]" },
  en_curso: { texto: "En llamada", clase: "bg-[#eef7e6] text-[#3f6b18]" },
  terminada: { texto: "Terminada", clase: "bg-[#e7f7ee] text-[#00693c]" },
  fallida: { texto: "Falló", clase: "bg-[#fceceb] text-[#b3261e]" },
  reprogramada: { texto: "Reintento", clase: "bg-[#fdf3e3] text-[#8a5300]" },
  omitida: { texto: "Omitida", clase: "bg-[var(--surface-2)] text-[var(--text-3)]" },
};

export default function CampanasPage() {
  const router = useRouter();
  const esPromerica = activeTenantId() === "promerica";
  useEffect(() => {
    if (!esPromerica) router.replace("/");
  }, [esPromerica, router]);

  const [vista, setVista] = useState<Vista | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // Formulario de nueva campaña
  const [nombre, setNombre] = useState("");
  const [tramo, setTramo] = useState<TramoMora | "todos">("31_60");
  const [concurrencia, setConcurrencia] = useState(10);
  const [maxIntentos, setMaxIntentos] = useState(3);
  const [minutosEntreIntentos, setMinutosEntreIntentos] = useState(120);
  const [ventana, setVentana] = useState<VentanaLlamado>({
    horaInicio: 8,
    horaFin: 18,
    dias: [1, 2, 3, 4, 5, 6],
  });
  const [numero, setNumero] = useState("");
  // Arranca en simulación SIEMPRE. Marcar de verdad es una casilla que alguien
  // tiene que marcar a mano, con la advertencia al lado.
  const [real, setReal] = useState(false);
  const [archivo, setArchivo] = useState<{ nombre: string; csv: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);

  const cargarLista = useCallback(async () => {
    try {
      const r = await fetch("/api/cobros/campanas", { cache: "no-store" });
      const j = (await r.json()) as Vista & { ok: boolean };
      if (j.ok) {
        setVista(j);
        if (!numero && j.numeros[0]) setNumero(j.numeros[0].id);
      }
    } catch {
      setError("No se pudo leer las campañas.");
    }
  }, [numero]);

  const cargarDetalle = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/cobros/campanas/${id}?limite=60`, { cache: "no-store" });
      const j = (await r.json()) as Detalle & { ok: boolean };
      if (j.ok) setDetalle(j);
    } catch {
      /* el siguiente tick lo vuelve a intentar */
    }
  }, []);

  useEffect(() => {
    if (esPromerica) void cargarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esPromerica]);

  useEffect(() => {
    if (sel) void cargarDetalle(sel);
  }, [sel, cargarDetalle]);

  // El latido: mientras la campaña corre, esta llamada es la que hace que
  // salgan las llamadas. La pantalla no solo mira, empuja.
  useEffect(() => {
    if (!sel || detalle?.campana.estado !== "corriendo") return;
    const t = setInterval(() => {
      void fetch(`/api/cobros/campanas/${sel}/tick`, { method: "POST" })
        .then((r) => r.json())
        .then(() => {
          void cargarDetalle(sel);
          void cargarLista();
        })
        .catch(() => undefined);
    }, 4000);
    return () => clearInterval(t);
  }, [sel, detalle?.campana.estado, cargarDetalle, cargarLista]);

  const leerArchivo = useCallback(async (file: File) => {
    const csv = await file.text();
    setArchivo({ nombre: file.name, csv });
    setPreview(null);
    setError(null);
    try {
      const r = await fetch("/api/cobros/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const j = (await r.json()) as {
        ok: boolean;
        resumen?: Preview;
        error?: string;
      };
      if (j.ok && j.resumen) setPreview(j.resumen);
      else setError(j.error ?? "No se pudo leer el archivo.");
    } catch {
      setError("No se pudo leer el archivo.");
    }
  }, []);

  const crear = useCallback(async () => {
    setOcupado(true);
    setError(null);
    try {
      let ids: string[] | undefined;
      if (archivo) {
        const r = await fetch("/api/cobros/importar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv: archivo.csv, archivo: archivo.nombre, crear: true }),
        });
        const j = (await r.json()) as { ok: boolean; ids?: string[]; error?: string };
        if (!j.ok) {
          setError(j.error ?? "No se pudo importar el archivo.");
          setOcupado(false);
          return;
        }
        ids = j.ids;
      }

      const r = await fetch("/api/cobros/campanas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          phoneNumberId: numero,
          concurrencia,
          maxIntentos,
          minutosEntreIntentos,
          ventana,
          real,
          origenArchivo: archivo?.nombre,
          ids,
          filtro: ids ? undefined : { tramo },
        }),
      });
      const j = (await r.json()) as {
        ok: boolean;
        campana?: CampanaResumen;
        estimado?: { humano: string };
        error?: string;
      };
      if (j.ok && j.campana) {
        setCreando(false);
        setArchivo(null);
        setPreview(null);
        setNombre("");
        setSel(j.campana.id);
        await cargarLista();
      } else {
        setError(j.error ?? "No se pudo crear la campaña.");
      }
    } catch {
      setError("No se pudo crear la campaña.");
    }
    setOcupado(false);
  }, [archivo, nombre, numero, concurrencia, maxIntentos, minutosEntreIntentos, ventana, tramo, real, cargarLista]);

  const cambiar = useCallback(
    async (id: string, cambio: Record<string, unknown>) => {
      await fetch(`/api/cobros/campanas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambio),
      });
      await cargarDetalle(id);
      await cargarLista();
    },
    [cargarDetalle, cargarLista],
  );

  if (!esPromerica) return <div className="flex-1 bg-surface" />;

  const c = detalle?.campana;
  const p = c?.progreso;

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-4 py-3 sm:px-5">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Campañas de llamadas</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            El agente de cobros marca la cartera por lotes, con un tope de llamadas a la vez
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreando((v) => !v)}
          className="inline-flex min-h-[38px] items-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-[13px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110"
        >
          {creando ? <X size={15} /> : <Plus size={15} />}
          {creando ? "Cancelar" : "Nueva campaña"}
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
        {vista && !vista.hayTelefonia && (
          <div className="rounded-xl border border-[#cfe0ef] bg-[#eef5fb] p-3 text-xs text-[#1c4e77]">
            <strong>Sin telefonía conectada.</strong> Las llamadas se simulan con una mezcla de
            resultados como la de una cartera real, y las fichas se mueven igual. Con{" "}
            <code>VAPI_PRIVATE_KEY</code> el mismo motor marca de verdad.
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-[#f2c9c6] bg-[#fceceb] p-3 text-xs text-[#b3261e]">
            {error}
          </div>
        )}

        {/* ── Nueva campaña ── */}
        {creando && (
          <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
            <p className="text-[13.5px] font-extrabold tracking-tight text-[var(--text)]">
              Nueva campaña
            </p>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className="text-[11.5px] font-semibold text-[var(--text-3)]">Nombre</label>
                  <input
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Mora 31 a 60, agosto"
                    className={cn(CAMPO, "mt-1")}
                  />
                </div>

                <div>
                  <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                    A quién se llama
                  </label>
                  {archivo ? (
                    <div className="mt-1 rounded-xl border border-line bg-surface p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[13px] font-bold text-[var(--text)]">
                          {archivo.nombre}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setArchivo(null);
                            setPreview(null);
                          }}
                          className="text-[12px] font-semibold text-[var(--text-3)] hover:text-[var(--text)]"
                        >
                          Quitar
                        </button>
                      </div>
                      {preview && (
                        <ul className="mt-2 space-y-0.5 text-[12px] text-[var(--text-2)]">
                          <li>
                            <strong>{preview.aceptadas.toLocaleString("en-US")}</strong> contactos
                            listos para llamar
                          </li>
                          {preview.rechazadas > 0 && (
                            <li className="text-[#b3261e]">
                              {preview.rechazadas} filas sin número marcable
                            </li>
                          )}
                          {preview.duplicadas > 0 && (
                            <li className="text-[#8a5300]">
                              {preview.duplicadas} repetidas, se llaman una sola vez
                            </li>
                          )}
                          {preview.columnasIgnoradas.length > 0 && (
                            <li className="text-[var(--text-3)]">
                              Columnas ignoradas: {preview.columnasIgnoradas.join(", ")}
                            </li>
                          )}
                        </ul>
                      )}
                    </div>
                  ) : (
                    <div className="mt-1 space-y-2">
                      <select
                        value={tramo}
                        onChange={(e) => setTramo(e.target.value as TramoMora | "todos")}
                        className={CAMPO}
                      >
                        {TRAMOS.map((t) => (
                          <option key={t} value={t}>
                            {t === "todos" ? "Toda la cartera en mora" : TRAMO_NOMBRE[t]}
                          </option>
                        ))}
                      </select>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => inputArchivo.current?.click()}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-[12.5px] font-semibold text-[var(--text-2)] transition hover:bg-surface"
                        >
                          <Upload size={14} /> Subir archivo de contactos
                        </button>
                        <a
                          href="/api/cobros/importar"
                          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand hover:underline"
                        >
                          <Download size={13} /> Plantilla
                        </a>
                      </div>
                      <input
                        ref={inputArchivo}
                        type="file"
                        accept=".csv,text/csv,text/plain"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) void leerArchivo(f);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                    Número de salida
                  </label>
                  <select
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    className={cn(CAMPO, "mt-1")}
                  >
                    {(vista?.numeros ?? []).length === 0 ? (
                      <option value="">Sin números configurados</option>
                    ) : (
                      vista?.numeros.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.nombre || n.numero} · {n.numero}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-baseline justify-between">
                    <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                      Llamadas al mismo tiempo
                    </label>
                    <span className="text-[15px] font-extrabold text-brand">{concurrencia}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={vista?.concurrenciaMax ?? 50}
                    value={concurrencia}
                    onChange={(e) => setConcurrencia(Number(e.target.value))}
                    className="mt-2 w-full accent-[var(--brand-blue)]"
                  />
                  <p className="mt-1 text-[11.5px] text-[var(--text-3)]">
                    Cuando una termina, entra la siguiente. Nunca hay más de {concurrencia} en
                    línea.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                      Intentos por contacto
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={maxIntentos}
                      onChange={(e) => setMaxIntentos(Number(e.target.value))}
                      className={cn(CAMPO, "mt-1")}
                    />
                  </div>
                  <div>
                    <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                      Espera entre intentos
                    </label>
                    <select
                      value={minutosEntreIntentos}
                      onChange={(e) => setMinutosEntreIntentos(Number(e.target.value))}
                      className={cn(CAMPO, "mt-1")}
                    >
                      <option value={30}>30 minutos</option>
                      <option value={120}>2 horas</option>
                      <option value={480}>8 horas</option>
                      <option value={1440}>1 día</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[11.5px] font-semibold text-[var(--text-3)]">
                    Horario permitido
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <select
                      value={ventana.horaInicio}
                      onChange={(e) => setVentana({ ...ventana, horaInicio: Number(e.target.value) })}
                      className={CAMPO}
                    >
                      {Array.from({ length: 24 }, (_, h) => (
                        <option key={h} value={h}>{`${h}:00`}</option>
                      ))}
                    </select>
                    <span className="text-[12px] text-[var(--text-3)]">a</span>
                    <select
                      value={ventana.horaFin}
                      onChange={(e) => setVentana({ ...ventana, horaFin: Number(e.target.value) })}
                      className={CAMPO}
                    >
                      {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => (
                        <option key={h} value={h}>{`${h}:00`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    {DIAS.map((d, i) => {
                      const activo = ventana.dias.includes(i);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() =>
                            setVentana({
                              ...ventana,
                              dias: activo
                                ? ventana.dias.filter((x) => x !== i)
                                : [...ventana.dias, i].sort(),
                            })
                          }
                          className={cn(
                            "h-8 w-8 rounded-lg text-[12px] font-bold transition",
                            activo
                              ? "bg-brand text-white"
                              : "border border-line bg-card text-[var(--text-3)] hover:bg-surface",
                          )}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-[var(--text-3)]">
                    Fuera de este horario la campaña no marca, aunque esté corriendo.
                  </p>
                </div>
              </div>
            </div>

            {/* Marcar de verdad es lo único de esta pantalla que no se puede
                deshacer: una llamada hecha ya no se recoge. Por eso va apagado
                por defecto y con la advertencia pegada, no escondida. */}
            <label
              className={cn(
                "mt-4 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
                real ? "border-[#f2c9c6] bg-[#fceceb]" : "border-line bg-surface",
              )}
            >
              <input
                type="checkbox"
                checked={real}
                disabled={!vista?.hayTelefonia}
                onChange={(e) => setReal(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-red)]"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-bold text-[var(--text)]">
                  Marcar de verdad
                </span>
                <span className="block text-[12px] text-[var(--text-2)]">
                  {!vista?.hayTelefonia
                    ? "No hay telefonía configurada: esta campaña va a simular las llamadas."
                    : real
                      ? "Se van a marcar teléfonos reales. Revisá que la lista sea la que querés llamar."
                      : "Apagado: las llamadas se simulan y las fichas se mueven igual, sin llamarle a nadie."}
                </span>
              </span>
            </label>

            <button
              type="button"
              onClick={() => void crear()}
              disabled={ocupado || !numero}
              className={cn(
                "mt-3 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-[13.5px] font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50",
                real ? "bg-[var(--brand-red)]" : "bg-brand shadow-brand/25",
              )}
            >
              <Play size={15} />
              {ocupado ? "Creando..." : real ? "Crear y empezar a llamar" : "Crear y simular"}
            </button>
          </div>
        )}

        {/* ── Lista ── */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(vista?.campanas ?? []).map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(x.id)}
              className={cn(
                "rounded-2xl border bg-card p-4 text-left shadow-sm transition hover:border-brand",
                sel === x.id ? "border-brand ring-1 ring-brand/30" : "border-line",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13.5px] font-extrabold tracking-tight text-[var(--text)]">
                  {x.nombre}
                </p>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold",
                    x.estado === "corriendo"
                      ? "bg-[#eef7e6] text-[#3f6b18]"
                      : x.estado === "terminada"
                        ? "bg-[#e7f7ee] text-[#00693c]"
                        : x.estado === "pausada"
                          ? "bg-[#fdf3e3] text-[#8a5300]"
                          : "bg-[var(--surface-2)] text-[var(--text-2)]",
                  )}
                >
                  {CAMPANA_ESTADO_NOMBRE[x.estado]}
                </span>
              </div>
              <p className="mt-1 text-[11.5px] text-[var(--text-3)]">
                {x.progreso.total.toLocaleString("en-US")} contactos · de {x.concurrencia} en{" "}
                {x.concurrencia}
                {x.simulada && " · simulada"}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${x.progreso.completadoPct}%` }}
                />
              </div>
              <div className="mt-2 flex items-baseline justify-between text-[11.5px]">
                <span className="text-[var(--text-3)]">{x.progreso.completadoPct}% completado</span>
                <span className="font-bold text-[var(--text)]">
                  {x.progreso.promesas} {x.progreso.promesas === 1 ? "promesa" : "promesas"}
                </span>
              </div>
            </button>
          ))}

          {(vista?.campanas.length ?? 0) === 0 && !creando && (
            <div className="rounded-2xl border border-dashed border-line p-8 text-center sm:col-span-2 xl:col-span-3">
              <p className="text-[13px] text-[var(--text-3)]">
                Todavía no hay campañas. Creá una desde la cartera o subí un archivo de contactos.
              </p>
            </div>
          )}
        </div>

        {/* ── Detalle ── */}
        {c && p && detalle && (
          <div className="rounded-2xl border border-line bg-card shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[14px] font-extrabold tracking-tight text-[var(--text)]">
                  {c.nombre}
                </p>
                <p className="text-[12px] text-[var(--text-3)]">
                  {c.estado === "corriendo"
                    ? `${p.enCurso} en línea · ${p.pendientes.toLocaleString("en-US")} en cola${
                        // La estimación solo tiene sentido mientras se esté
                        // marcando: con la cola entera en espera de reintento,
                        // "faltan 3 min" es mentira.
                        p.enCurso > 0 ? ` · faltan ${detalle.restante.humano}` : ""
                      }`
                    : `${p.terminadas + p.fallidas} de ${p.total.toLocaleString("en-US")} procesados`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.estado === "corriendo" ? (
                  <button
                    type="button"
                    onClick={() => void cambiar(c.id, { estado: "pausada" })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-[12.5px] font-semibold text-[var(--text-2)] transition hover:bg-surface"
                  >
                    <Pause size={14} /> Pausar
                  </button>
                ) : c.estado === "pausada" || c.estado === "borrador" ? (
                  <button
                    type="button"
                    onClick={() => void cambiar(c.id, { estado: "corriendo" })}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-[12.5px] font-bold text-white transition hover:brightness-110"
                  >
                    <Play size={14} /> Reanudar
                  </button>
                ) : null}
                {(c.estado === "corriendo" || c.estado === "pausada") && (
                  <button
                    type="button"
                    onClick={() => void cambiar(c.id, { estado: "cancelada" })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-[12.5px] font-semibold text-[#b3261e] transition hover:bg-[#fceceb]"
                  >
                    <Square size={13} /> Cancelar
                  </button>
                )}
              </div>
            </div>

            {detalle.motivo && (
              <p className="flex items-center gap-2 border-b border-line bg-[#fdf3e3] px-4 py-2 text-[12px] text-[#8a5300]">
                <AlertTriangle size={13} /> {detalle.motivo}
              </p>
            )}

            <div className="grid grid-cols-2 gap-px border-b border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
              {[
                ["En línea", String(p.enCurso)],
                ["En cola", p.pendientes.toLocaleString("en-US")],
                ["Contactos", `${p.contactos} · ${p.tasaContactoPct}%`],
                ["Promesas", String(p.promesas)],
                ["Prometido", dineroCorto(p.montoPrometido)],
                ["Minutos", String(p.minutos)],
              ].map(([label, valor]) => (
                <div key={label} className="bg-card px-4 py-3">
                  <p className="text-[11px] font-semibold text-[var(--text-3)]">{label}</p>
                  <p className="mt-0.5 text-[17px] font-extrabold tracking-tight text-[var(--text)]">
                    {valor}
                  </p>
                </div>
              ))}
            </div>

            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full min-w-[620px] border-collapse text-left">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-line bg-surface text-[11px] uppercase tracking-wide text-[var(--text-3)]">
                    <th className="px-4 py-2 font-bold">Contacto</th>
                    <th className="px-4 py-2 font-bold">Estado</th>
                    <th className="px-4 py-2 font-bold">Resultado</th>
                    <th className="px-4 py-2 font-bold">Intentos</th>
                    <th className="px-4 py-2 font-bold">Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.items.map((i) => (
                    <tr key={i.id} className="border-b border-line/70 last:border-0">
                      <td className="px-4 py-2 align-top">
                        <Link
                          href={`/cobros/${i.deudorId}`}
                          className="text-[13px] font-bold text-[var(--text)] hover:text-brand"
                        >
                          {i.nombre}
                        </Link>
                        <p className="text-[11.5px] text-[var(--text-3)]">
                          {telefonoSv(i.telefono)}
                        </p>
                      </td>
                      <td className="px-4 py-2 align-top">
                        <span
                          className={cn(
                            "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold",
                            ESTADO_ITEM[i.estado].clase,
                          )}
                        >
                          {ESTADO_ITEM[i.estado].texto}
                        </span>
                        {i.error && (
                          <p className="mt-1 max-w-[220px] text-[11px] text-[#b3261e]">{i.error}</p>
                        )}
                      </td>
                      <td className="px-4 py-2 align-top text-[12.5px] text-[var(--text-2)]">
                        {i.resultado ? RESULTADO_NOMBRE[i.resultado] : "—"}
                      </td>
                      <td className="px-4 py-2 align-top text-[12.5px] text-[var(--text-2)]">
                        {i.intentos}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 align-top text-[11.5px] text-[var(--text-3)]">
                        {fechaHora(i.actualizado)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="border-t border-line px-4 py-2 text-[11.5px] text-[var(--text-3)]">
              Mostrando {detalle.items.length} de {detalle.total.toLocaleString("en-US")} contactos ·
              costo acumulado {dinero(p.costo)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
