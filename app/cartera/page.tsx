/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bath,
  BedDouble,
  Camera,
  Car,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";
import { dinero, dineroMes, fechaCorta, metros, precioDe, varas } from "@/lib/inmobiliaria-formato";
import { filtrarCartera } from "@/lib/inmobiliaria-cartera";
import { ordenarFotos } from "@/lib/inmobiliaria-publicacion";
import {
  ESTADO_NOMBRE,
  OPERACION_NOMBRE,
  TIPO_NOMBRE,
  nombreEstado,
  type Cartera,
  type EstadoPropiedad,
  type Propiedad,
  type TipoOperacion,
  type TipoPropiedad,
} from "@/lib/inmobiliaria-tipos";

const ESTADO_TONO: Record<EstadoPropiedad, string> = {
  disponible: "bg-[var(--brand-green)] text-white",
  apartada: "bg-[var(--brand-accent)] text-white",
  vendida: "bg-[var(--brand-red)] text-white",
};

const CAMPO =
  "rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-[var(--text)] outline-none transition focus:border-brand [color-scheme:light]";

// La foto que representa a la propiedad es la misma que abriría el anuncio: la
// fachada en una casa, la sala en un apartamento. No la primera que se subió.
function portadaDe(p: Propiedad): string | undefined {
  return ordenarFotos(p.fotos, p.tipo)[0]?.src;
}

export default function CarteraPage() {
  const router = useRouter();
  const esInmobiliaria = activeTenantId() === "inmobiliaria";
  useEffect(() => {
    if (!esInmobiliaria) router.replace("/");
  }, [esInmobiliaria, router]);

  const [cartera, setCartera] = useState<Cartera | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [vista, setVista] = useState<"galeria" | "lista">("galeria");
  const [texto, setTexto] = useState("");
  const [operacion, setOperacion] = useState<TipoOperacion | "todas">("todas");
  const [tipo, setTipo] = useState<TipoPropiedad | "todos">("todos");
  const [estado, setEstado] = useState<EstadoPropiedad | "todos">("todos");
  const [zona, setZona] = useState("todas");

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const r = await fetch("/api/inmobiliaria/cartera", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) {
        setCartera(d.cartera);
        setError(null);
      } else {
        setError(d.error ?? "No se pudo leer la cartera.");
      }
    } catch {
      setError("No se pudo leer la cartera.");
    }
    setCargando(false);
  }, []);

  useEffect(() => {
    if (esInmobiliaria) cargar();
  }, [cargar, esInmobiliaria]);

  const zonas = useMemo(
    () => Array.from(new Set((cartera?.propiedades ?? []).map((p) => p.municipio))).sort(),
    [cartera],
  );

  const visibles = useMemo(
    () => filtrarCartera(cartera?.propiedades ?? [], { texto, operacion, tipo, estado, zona }),
    [cartera, texto, operacion, tipo, estado, zona],
  );

  if (!esInmobiliaria) return <div className="flex-1 bg-surface" />;

  const alertas = cartera?.alertas;
  const publicadasMal = (cartera?.propiedades ?? []).filter((p) => p.publicadaSinEstar);

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-4 py-3 sm:px-5">
        <div>
          <h1 className="text-[17px] font-extrabold tracking-tight text-brand">Cartera</h1>
          <p className="text-[12.5px] text-[var(--text-3)]">
            {cartera
              ? `${cartera.resumen.enVenta} en venta por ${dinero(cartera.resumen.valorVenta)} · ${cartera.resumen.enAlquiler} en alquiler por ${dineroMes(cartera.resumen.rentaMensual)}`
              : "Cargando las propiedades"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cargar}
            disabled={cargando}
            aria-label="Actualizar"
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-60"
          >
            <RefreshCw size={13} className={cn(cargando && "animate-spin")} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
          {/* La entrada al alta desde el teléfono: es lo primero que busca el
              agente cuando ya está parado frente a la casa. */}
          <Link
            href="/cartera/nueva"
            className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-[13px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110"
          >
            <Camera size={16} />
            Agregar propiedad
          </Link>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-2xl border border-[var(--brand-red)]/40 bg-[var(--brand-red)]/10 px-4 py-3 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {cargando && !cartera && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-[300px] animate-pulse rounded-2xl border border-line bg-card" />
            ))}
          </div>
        )}

        {cartera && (
          <>
            {publicadasMal.length > 0 && (
              <div className="mb-4 rounded-2xl border border-[var(--brand-red)]/45 bg-[var(--brand-red)]/[0.07] px-4 py-3">
                <p className="flex items-center gap-2 text-[13px] font-bold text-[var(--brand-red)]">
                  <AlertCircle size={15} />
                  {publicadasMal.length === 1
                    ? "Una propiedad sigue publicada y ya no se puede vender"
                    : `${publicadasMal.length} propiedades siguen publicadas y ya no se pueden vender`}
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-2)]">
                  {publicadasMal
                    .map((p) => `${p.codigo} está ${nombreEstado(p.estado, p.operacion).toLowerCase()}`)
                    .join(" · ")}
                  . Cada consulta que entre por ellas es tiempo perdido y un cliente molesto.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {publicadasMal.map((p) => (
                    <Link
                      key={p.id}
                      href={`/cartera/${p.id}`}
                      className="rounded-lg border border-[var(--brand-red)]/40 bg-card px-2.5 py-1 text-[12px] font-semibold text-[var(--brand-red)] transition hover:bg-[var(--brand-red)]/10"
                    >
                      Abrir {p.codigo}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {alertas && (alertas.exclusivasVencidas.length > 0 || alertas.exclusivasPorVencer.length > 0) && (
              <p className="mb-4 flex items-start gap-2 rounded-xl border border-[var(--brand-accent)]/45 bg-[var(--brand-accent)]/[0.08] px-3.5 py-2.5 text-[12.5px] text-[var(--text-2)]">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-[var(--brand-accent)]" />
                <span>
                  {alertas.exclusivasVencidas.length > 0 && (
                    <>Exclusiva vencida en {alertas.exclusivasVencidas.join(", ")}. </>
                  )}
                  {alertas.exclusivasPorVencer.length > 0 && (
                    <>Por vencer este mes: {alertas.exclusivasPorVencer.join(", ")}.</>
                  )}
                </span>
              </p>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <label className="relative">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-3)]"
                />
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Código, zona o propietario"
                  className={cn(CAMPO, "w-64 pl-9")}
                />
              </label>
              <select
                value={operacion}
                onChange={(e) => setOperacion(e.target.value as typeof operacion)}
                className={CAMPO}
              >
                <option value="todas">Venta y alquiler</option>
                {(["venta", "alquiler"] as TipoOperacion[]).map((o) => (
                  <option key={o} value={o}>
                    {OPERACION_NOMBRE[o]}
                  </option>
                ))}
              </select>
              <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)} className={CAMPO}>
                <option value="todos">Todo tipo</option>
                {(Object.keys(TIPO_NOMBRE) as TipoPropiedad[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_NOMBRE[t]}
                  </option>
                ))}
              </select>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value as typeof estado)}
                className={CAMPO}
              >
                <option value="todos">Todo estado</option>
                {(Object.keys(ESTADO_NOMBRE) as EstadoPropiedad[]).map((e) => (
                  <option key={e} value={e}>
                    {ESTADO_NOMBRE[e]}
                  </option>
                ))}
              </select>
              <select value={zona} onChange={(e) => setZona(e.target.value)} className={CAMPO}>
                <option value="todas">Toda zona</option>
                {zonas.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>

              <div className="ml-auto inline-flex rounded-xl border border-line bg-card p-0.5">
                {([
                  { id: "galeria", Icon: LayoutGrid, label: "Galería" },
                  { id: "lista", Icon: List, label: "Lista" },
                ] as const).map(({ id, Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setVista(id)}
                    aria-label={label}
                    title={label}
                    className={cn(
                      "flex h-8 w-9 items-center justify-center rounded-[10px] transition",
                      vista === id
                        ? "bg-brand text-white"
                        : "text-[var(--text-3)] hover:bg-surface hover:text-[var(--text-2)]",
                    )}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </div>

            {visibles.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--border-2)] px-4 py-10 text-center text-[13px] text-[var(--text-2)]">
                Ninguna propiedad calza con esa búsqueda.
              </p>
            ) : vista === "galeria" ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibles.map((p) => (
                  <TarjetaPropiedad key={p.id} p={p} />
                ))}
              </div>
            ) : (
              <TablaPropiedades propiedades={visibles} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Sello({ p }: { p: Propiedad }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm",
        ESTADO_TONO[p.estado],
      )}
    >
      {nombreEstado(p.estado, p.operacion)}
    </span>
  );
}

function Ficha({ p }: { p: Propiedad }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[var(--text-2)]">
      {p.habitaciones > 0 && (
        <span className="inline-flex items-center gap-1">
          <BedDouble size={13} /> {p.habitaciones}
        </span>
      )}
      {p.banos > 0 && (
        <span className="inline-flex items-center gap-1">
          <Bath size={13} /> {p.banos}
        </span>
      )}
      {p.parqueos > 0 && (
        <span className="inline-flex items-center gap-1">
          <Car size={13} /> {p.parqueos}
        </span>
      )}
      {p.areaConstruccion > 0 && <span>{metros(p.areaConstruccion)}</span>}
      {p.areaTerreno > 0 && <span>{varas(p.areaTerreno)}</span>}
    </div>
  );
}

function TarjetaPropiedad({ p }: { p: Propiedad }) {
  return (
    <Link
      href={`/cartera/${p.id}`}
      className={cn(
        "group overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md",
        p.publicadaSinEstar ? "border-[var(--brand-red)]/55" : "border-line",
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
        <img
          src={portadaDe(p)}
          alt={p.titulo}
          className={cn(
            "h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]",
            p.estado !== "disponible" && "opacity-70 saturate-50",
          )}
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
          <Sello p={p} />
          {p.exclusiva && (
            <span className="rounded-full bg-card/90 px-2.5 py-1 text-[11px] font-bold text-brand shadow-sm">
              Exclusiva
            </span>
          )}
        </div>
        {p.publicadaSinEstar && (
          <p className="absolute inset-x-0 bottom-0 bg-[var(--brand-red)] px-3 py-1.5 text-[11.5px] font-bold text-white">
            Publicada y ya no se puede vender
          </p>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[17px] font-extrabold tracking-tight text-[var(--text)]">
            {precioDe(p)}
          </p>
          <span className="text-[11.5px] font-semibold text-[var(--text-3)]">{p.codigo}</span>
        </div>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--text-2)]">
          {TIPO_NOMBRE[p.tipo]} {p.operacion === "alquiler" ? "en alquiler" : "en venta"} en {p.zona}
        </p>
        <p className="text-[12px] text-[var(--text-3)]">{p.municipio}</p>
        <div className="mt-2.5 border-t border-line pt-2.5">
          <Ficha p={p} />
        </div>
        {(p.exclusivaVencida || p.interesados > 0) && (
          <p className="mt-2 text-[11.5px] font-semibold text-[var(--brand-accent)]">
            {p.exclusivaVencida
              ? `Exclusiva vencida el ${fechaCorta(p.exclusivaHasta ?? "")}`
              : `${p.interesados} ${p.interesados === 1 ? "interesado" : "interesados"} en el pipeline`}
          </p>
        )}
      </div>
    </Link>
  );
}

function TablaPropiedades({ propiedades }: { propiedades: Propiedad[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-card">
      <table className="w-full min-w-[860px] text-left text-[12.5px]">
        <thead className="border-b border-line text-[11.5px] uppercase tracking-wide text-[var(--text-3)]">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Propiedad</th>
            <th className="px-4 py-2.5 font-semibold">Precio</th>
            <th className="px-4 py-2.5 font-semibold">Detalle</th>
            <th className="px-4 py-2.5 font-semibold">Estado</th>
            <th className="px-4 py-2.5 font-semibold">Propietario</th>
            <th className="px-4 py-2.5 font-semibold">Exclusiva</th>
          </tr>
        </thead>
        <tbody>
          {propiedades.map((p) => (
            <tr
              key={p.id}
              className={cn(
                "border-b border-line last:border-0",
                p.publicadaSinEstar && "bg-[var(--brand-red)]/[0.05]",
              )}
            >
              <td className="px-4 py-2.5">
                <Link href={`/cartera/${p.id}`} className="flex items-center gap-3">
                  <img
                    src={portadaDe(p)}
                    alt=""
                    className="h-11 w-14 shrink-0 rounded-lg object-cover"
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-[var(--text)]">
                      {TIPO_NOMBRE[p.tipo]} {p.operacion === "alquiler" ? "en alquiler" : "en venta"} en {p.zona}
                    </span>
                    <span className="block text-[11.5px] text-[var(--text-3)]">
                      {p.codigo} · {p.municipio}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="px-4 py-2.5 font-extrabold text-[var(--text)]">{precioDe(p)}</td>
              <td className="px-4 py-2.5">
                <Ficha p={p} />
              </td>
              <td className="px-4 py-2.5">
                <span className="flex flex-col items-start gap-1">
                  <Sello p={p} />
                  {p.publicadaSinEstar && (
                    <span className="text-[11px] font-bold text-[var(--brand-red)]">
                      Sigue publicada
                    </span>
                  )}
                </span>
              </td>
              <td className="px-4 py-2.5 text-[var(--text-2)]">
                {p.propietario.nombre}
                {p.interesados > 0 && (
                  <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[var(--text-3)]">
                    <Users size={12} /> {p.interesados} en el pipeline
                  </span>
                )}
              </td>
              <td className="px-4 py-2.5">
                {p.exclusiva ? (
                  <span
                    className={cn(
                      "font-semibold",
                      p.exclusivaVencida
                        ? "text-[var(--brand-red)]"
                        : p.exclusivaPorVencer
                          ? "text-[var(--brand-accent)]"
                          : "text-[var(--text-2)]",
                    )}
                  >
                    {p.exclusivaVencida ? "Venció el " : "Hasta el "}
                    {fechaCorta(p.exclusivaHasta ?? "")}
                  </span>
                ) : (
                  <span className="text-[var(--text-3)]">Abierta</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
