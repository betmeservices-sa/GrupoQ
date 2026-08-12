/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Bath,
  BedDouble,
  Car,
  Phone,
  Ruler,
  Share2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";
import { dinero, fechaLarga, metros, plazo, precioDe, varas } from "@/lib/inmobiliaria-formato";
import { ordenarFotos } from "@/lib/inmobiliaria-publicacion";
import {
  AMBIENTE_NOMBRE,
  OPERACION_EN,
  TIPO_NOMBRE,
  nombreEstado,
  type Propiedad,
} from "@/lib/inmobiliaria-tipos";

export default function FichaPropiedadPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const esInmobiliaria = activeTenantId() === "inmobiliaria";
  useEffect(() => {
    if (!esInmobiliaria) router.replace("/");
  }, [esInmobiliaria, router]);

  const [p, setP] = useState<Propiedad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [foto, setFoto] = useState(0);

  const cargar = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/inmobiliaria/cartera?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const d = await r.json();
      if (d.ok) {
        setP(d.propiedad);
        setError(null);
      } else {
        setError(d.error ?? "No se pudo abrir la ficha.");
      }
    } catch {
      setError("No se pudo abrir la ficha.");
    }
  }, []);

  useEffect(() => {
    if (esInmobiliaria && params?.id) cargar(params.id);
  }, [cargar, esInmobiliaria, params?.id]);

  if (!esInmobiliaria) return <div className="flex-1 bg-surface" />;

  // Mismo orden que usaría el anuncio: la ficha se ve como se va a ver publicada.
  const fotos = p ? ordenarFotos(p.fotos, p.tipo) : [];

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <Link
            href="/cartera"
            aria-label="Volver a la cartera"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-[var(--text-2)] transition hover:bg-surface"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-[17px] font-extrabold tracking-tight text-brand">
              {p ? p.codigo : "Ficha"}
            </h1>
            <p className="text-[12.5px] text-[var(--text-3)]">
              {p
                ? `${TIPO_NOMBRE[p.tipo]} ${OPERACION_EN[p.operacion]} en ${p.zona}, ${p.municipio}`
                : "Cargando"}
            </p>
          </div>
        </div>
        {p && p.estado === "disponible" && (
          <Link
            href={`/publicacion?id=${p.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-[13px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110"
          >
            <Share2 size={15} />
            Armar publicación
          </Link>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {error && (
          <p className="flex items-start gap-2.5 rounded-2xl border border-[var(--brand-red)]/40 bg-[var(--brand-red)]/10 px-4 py-3 text-[12.5px] text-[var(--text-2)]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        {p && (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <div>
              <div className="overflow-hidden rounded-2xl border border-line bg-card">
                <div className="relative aspect-[4/3] bg-surface-2">
                  <img
                    src={fotos[foto]?.src}
                    alt={`${p.titulo}, ${AMBIENTE_NOMBRE[fotos[foto]?.ambiente ?? "fachada"]}`}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-card/90 px-2.5 py-1 text-[11.5px] font-bold text-[var(--text-2)] shadow-sm">
                    {AMBIENTE_NOMBRE[fotos[foto]?.ambiente ?? "fachada"]}
                  </span>
                </div>
                {fotos.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto p-2.5">
                    {fotos.map((f, i) => (
                      <button
                        key={f.src}
                        type="button"
                        onClick={() => setFoto(i)}
                        aria-label={AMBIENTE_NOMBRE[f.ambiente]}
                        className={cn(
                          "h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition",
                          i === foto ? "border-brand" : "border-transparent opacity-70 hover:opacity-100",
                        )}
                      >
                        <img src={f.src} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-2xl border border-line bg-card p-5">
                <h2 className="text-sm font-bold text-[var(--text)]">Lo que se cuenta al cliente</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-2)]">{p.resumen}</p>
                {p.caracteristicas.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {p.caracteristicas.map((c) => (
                      <li key={c} className="flex items-start gap-2 text-[12.5px] text-[var(--text-2)]">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-card p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[28px] font-extrabold leading-none tracking-tight text-[var(--text)]">
                    {precioDe(p)}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11.5px] font-bold text-white",
                      p.estado === "disponible"
                        ? "bg-[var(--brand-green)]"
                        : p.estado === "apartada"
                          ? "bg-[var(--brand-accent)]"
                          : "bg-[var(--brand-red)]",
                    )}
                  >
                    {nombreEstado(p.estado, p.operacion)}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[var(--text-2)]">{p.titulo}</p>

                {/* Las dos preguntas de todo el que alquila, arriba y no en la
                    letra chica. */}
                {p.operacion === "alquiler" && (p.deposito || p.plazoMinimoMeses) && (
                  <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-surface px-3 py-2 text-[12.5px] font-semibold text-[var(--text-2)]">
                    {p.deposito ? <span>Depósito {dinero(p.deposito)}</span> : null}
                    {p.plazoMinimoMeses ? (
                      <span>Contrato mínimo {plazo(p.plazoMinimoMeses)}</span>
                    ) : null}
                  </p>
                )}

                {p.publicadaSinEstar && (
                  <p className="mt-3 flex items-start gap-2 rounded-xl border border-[var(--brand-red)]/50 bg-[var(--brand-red)]/[0.08] px-3 py-2.5 text-[12.5px] font-semibold text-[var(--brand-red)]">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    Sigue publicada en portales y redes. Bájala hoy y no agendes visitas nuevas.
                  </p>
                )}

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4 text-[12.5px]">
                  {p.habitaciones > 0 && (
                    <Dato Icon={BedDouble} label="Habitaciones" valor={String(p.habitaciones)} />
                  )}
                  {p.banos > 0 && <Dato Icon={Bath} label="Baños" valor={String(p.banos)} />}
                  {p.parqueos > 0 && <Dato Icon={Car} label="Parqueos" valor={String(p.parqueos)} />}
                  {p.areaConstruccion > 0 && (
                    <Dato Icon={Ruler} label="Construcción" valor={metros(p.areaConstruccion)} />
                  )}
                  {p.areaTerreno > 0 && (
                    <Dato Icon={Ruler} label="Terreno" valor={varas(p.areaTerreno)} />
                  )}
                  {p.anio && <Dato Icon={Ruler} label="Año" valor={String(p.anio)} />}
                </dl>
              </div>

              <div className="rounded-2xl border border-line bg-card p-5">
                <h2 className="text-sm font-bold text-[var(--text)]">Propietario</h2>
                <p className="mt-1.5 text-[13px] font-semibold text-[var(--text-2)]">
                  {p.propietario.nombre}
                </p>
                <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-2)]">
                  <Phone size={13} /> {p.propietario.telefono}
                </p>
                <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-3)]">
                  Este dato nunca sale en el anuncio ni se le pasa al comprador.
                </p>

                <div className="mt-3 border-t border-line pt-3 text-[12.5px]">
                  {p.exclusiva && p.exclusivaHasta ? (
                    <p
                      className={cn(
                        "font-semibold",
                        p.exclusivaVencida
                          ? "text-[var(--brand-red)]"
                          : p.exclusivaPorVencer
                            ? "text-[var(--brand-accent)]"
                            : "text-[var(--text-2)]",
                      )}
                    >
                      {p.exclusivaVencida
                        ? `Exclusiva vencida el ${fechaLarga(p.exclusivaHasta)}`
                        : `Exclusiva hasta el ${fechaLarga(p.exclusivaHasta)}`}
                      {p.exclusivaPorVencer && !p.exclusivaVencida
                        ? `, en ${p.diasDeExclusiva} días`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-[var(--text-3)]">
                      Sin exclusiva: otras inmobiliarias pueden venderla.
                    </p>
                  )}
                </div>
              </div>

              {p.interesados > 0 && (
                <Link
                  href="/pipeline"
                  className="flex items-center gap-2.5 rounded-2xl border border-line bg-card p-4 text-[13px] font-semibold text-[var(--text-2)] transition hover:border-[var(--border-2)]"
                >
                  <Users size={16} className="text-brand" />
                  {p.interesados} {p.interesados === 1 ? "interesado" : "interesados"} en el pipeline
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Dato({
  Icon,
  label,
  valor,
}: {
  Icon: typeof BedDouble;
  label: string;
  valor: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={15} className="mt-0.5 shrink-0 text-brand" />
      <div>
        <dt className="text-[11.5px] text-[var(--text-3)]">{label}</dt>
        <dd className="font-bold text-[var(--text)]">{valor}</dd>
      </div>
    </div>
  );
}
