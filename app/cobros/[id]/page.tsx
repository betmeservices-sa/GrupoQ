"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Ban,
  FileText,
  HandCoins,
  Phone,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenantId } from "@/lib/tenants/active";
import {
  cuandoVence,
  dinero,
  duracion,
  fechaCorta,
  fechaHora,
  iniciales,
  telefonoSv,
} from "@/lib/cobros-formato";
import {
  ACCION_NOMBRE,
  PRODUCTO_NOMBRE,
  SENTIMIENTO_NOMBRE,
  type DeudorVista,
  type Gestion,
} from "@/lib/cobros-tipos";
import { EstadoPill, ResultadoPill, RiesgoPill, TramoPill } from "@/components/cobros/Pills";

const CAMPO =
  "w-full rounded-xl border border-line bg-card px-3 py-2 text-[13px] text-[var(--text)] outline-none transition focus:border-brand";

const BOTON_SEC =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-card px-3 py-2 text-[12.5px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-50";

function Dato({ label, valor, fuerte }: { label: string; valor: string; fuerte?: boolean }) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold text-[var(--text-3)]">{label}</p>
      <p
        className={cn(
          "mt-0.5 tracking-tight text-[var(--text)]",
          fuerte ? "text-[20px] font-extrabold" : "text-[14px] font-bold",
        )}
      >
        {valor}
      </p>
    </div>
  );
}

const ICONO_GESTION: Record<Gestion["tipo"], typeof Phone> = {
  llamada: Phone,
  nota: StickyNote,
  whatsapp: FileText,
  pago: HandCoins,
  sistema: FileText,
};

export default function FichaDeudorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const esPromerica = activeTenantId() === "promerica";
  useEffect(() => {
    if (!esPromerica) router.replace("/");
  }, [esPromerica, router]);

  const [d, setD] = useState<DeudorVista | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [numeros, setNumeros] = useState<Array<{ id: string; numero: string; nombre: string }>>([]);
  const [numero, setNumero] = useState("");

  const cargar = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/cobros/cartera?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = (await r.json()) as { ok: boolean; deudor?: DeudorVista; error?: string };
      if (j.ok && j.deudor) {
        setD(j.deudor);
        setError(null);
      } else {
        setError(j.error ?? "No se pudo leer la cuenta.");
      }
    } catch {
      setError("No se pudo leer la cuenta.");
    }
  }, []);

  useEffect(() => {
    if (esPromerica && params?.id) void cargar(params.id);
  }, [cargar, esPromerica, params?.id]);

  useEffect(() => {
    if (!esPromerica) return;
    void fetch("/api/cobros/llamar", { cache: "no-store" })
      .then((r) => r.json())
      .then((j: { numeros?: Array<{ id: string; numero: string; nombre: string }> }) => {
        setNumeros(j.numeros ?? []);
        setNumero(j.numeros?.[0]?.id ?? "");
      })
      .catch(() => setNumeros([]));
  }, [esPromerica]);

  const parchear = useCallback(
    async (cambio: Record<string, unknown>, etiqueta: string) => {
      if (!d) return;
      setOcupado(etiqueta);
      setError(null);
      try {
        const r = await fetch("/api/cobros/cartera", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: d.id, ...cambio }),
        });
        const j = (await r.json()) as { ok: boolean; deudor?: DeudorVista; error?: string };
        if (j.ok && j.deudor) setD(j.deudor);
        else setError(j.error ?? "No se pudo guardar.");
      } catch {
        setError("No se pudo guardar.");
      }
      setOcupado(null);
    },
    [d],
  );

  const analizar = useCallback(
    async (gestionId: string) => {
      if (!d) return;
      setOcupado(`ia-${gestionId}`);
      setError(null);
      setAviso(null);
      try {
        const r = await fetch("/api/cobros/analizar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deudorId: d.id, gestionId }),
        });
        const j = (await r.json()) as { ok: boolean; deudor?: DeudorVista; error?: string };
        if (j.ok && j.deudor) {
          setD(j.deudor);
          setAviso("La ficha quedó actualizada con lo que dijo el cliente en la llamada.");
        } else {
          setError(j.error ?? "No se pudo analizar la llamada.");
        }
      } catch {
        setError("No se pudo analizar la llamada.");
      }
      setOcupado(null);
    },
    [d],
  );

  const llamar = useCallback(async () => {
    if (!d) return;
    setOcupado("llamar");
    setError(null);
    setAviso(null);
    try {
      const r = await fetch("/api/cobros/llamar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deudorId: d.id, phoneNumberId: numero }),
      });
      const j = (await r.json()) as { ok: boolean; aviso?: string | null; error?: string };
      if (j.ok) setAviso(j.aviso ?? "Llamada lanzada. El resultado entra solo cuando termine.");
      else setError(j.error ?? "No se pudo marcar.");
    } catch {
      setError("No se pudo marcar.");
    }
    setOcupado(null);
  }, [d, numero]);

  if (!esPromerica) return <div className="flex-1 bg-surface" />;

  if (!d) {
    return (
      <div className="flex h-full items-center justify-center bg-surface p-6">
        <p className="text-[13px] text-[var(--text-3)]">{error ?? "Cargando la cuenta..."}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-card px-4 py-3 sm:px-5">
        <Link
          href="/cobros"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-[var(--text-2)] transition hover:bg-surface"
          aria-label="Volver a la cartera"
        >
          <ArrowLeft size={17} />
        </Link>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-[13px] font-extrabold text-brand">
          {iniciales(d.nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-extrabold tracking-tight text-[var(--text)]">
            {d.nombre}
          </h1>
          <p className="truncate text-[12.5px] text-[var(--text-3)]">
            {PRODUCTO_NOMBRE[d.producto]} {d.cuenta} · {telefonoSv(d.telefono)}
            {d.documento ? ` · ${d.documento}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EstadoPill estado={d.estado} />
          <TramoPill tramo={d.tramo} dias={d.diasMora} />
          <RiesgoPill riesgo={d.riesgo} />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 sm:p-5">
        {error && (
          <div className="mb-4 rounded-xl border border-[#f2c9c6] bg-[#fceceb] p-3 text-xs text-[#b3261e]">
            {error}
          </div>
        )}
        {aviso && (
          <div className="mb-4 rounded-xl border border-[#c8e3d3] bg-[#e7f7ee] p-3 text-xs text-[#00693c]">
            {aviso}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          {/* Columna izquierda: la cuenta y lo que se puede hacer con ella */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <div className="grid grid-cols-2 gap-4">
                <Dato label="Monto vencido" valor={dinero(d.montoVencido)} fuerte />
                <Dato label="Saldo total" valor={dinero(d.saldoTotal)} fuerte />
                <Dato label="Cuota mensual" valor={dinero(d.cuotaMensual)} />
                <Dato
                  label="Último pago"
                  valor={
                    d.ultimoPago
                      ? `${dinero(d.ultimoPago.monto)} · ${fechaCorta(d.ultimoPago.fecha)}`
                      : "Sin registro"
                  }
                />
              </div>
            </div>

            {d.promesa && (
              <div
                className={cn(
                  "rounded-2xl border p-4 shadow-sm",
                  d.promesaVencida
                    ? "border-[#f2c9c6] bg-[#fceceb]"
                    : "border-[#c8e3d3] bg-[#e7f7ee]",
                )}
              >
                <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--text-2)]">
                  Promesa de pago
                </p>
                <p className="mt-1 text-[22px] font-extrabold leading-none tracking-tight text-[var(--text)]">
                  {dinero(d.promesa.monto)}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[12.5px] font-semibold",
                    d.promesaVencida ? "text-[#b3261e]" : "text-[#00693c]",
                  )}
                >
                  {fechaCorta(d.promesa.fecha)} · {cuandoVence(d.diasParaPromesa)}
                </p>
                <p className="mt-1 text-[11.5px] text-[var(--text-3)]">
                  La tomó {d.promesa.origen === "ia" ? "el agente de voz" : "un gestor"}
                </p>
              </div>
            )}

            {(d.resumenIa || d.proximaAccion) && (
              <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
                <p className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-brand">
                  <Sparkles size={13} /> Lo que entendió la IA
                </p>
                {d.resumenIa && (
                  <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-2)]">{d.resumenIa}</p>
                )}
                {d.proximaAccion && (
                  <p className="mt-3 text-[12.5px] font-semibold text-[var(--text)]">
                    Siguiente paso: {ACCION_NOMBRE[d.proximaAccion.tipo]}
                    {d.proximaAccion.cuando ? ` · ${fechaCorta(d.proximaAccion.cuando)}` : ""}
                  </p>
                )}
                {d.sentimiento && (
                  <p className="mt-1 text-[11.5px] text-[var(--text-3)]">
                    Actitud en la última llamada: {SENTIMIENTO_NOMBRE[d.sentimiento].toLowerCase()}
                  </p>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-line bg-card p-4 shadow-sm">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--text-3)]">
                Acciones
              </p>

              <div className="mt-3 space-y-2">
                <select
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className={CAMPO}
                  disabled={numeros.length === 0}
                >
                  {numeros.length === 0 ? (
                    <option>Sin números de salida</option>
                  ) : (
                    numeros.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.nombre || n.numero} · {n.numero}
                      </option>
                    ))
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => void llamar()}
                  disabled={!d.llamable || !numero || ocupado === "llamar"}
                  className="inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-xl bg-brand px-3.5 py-2 text-[13px] font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-110 disabled:opacity-50"
                >
                  <Phone size={15} />
                  {d.llamable ? "Llamar ahora" : "Cuenta no llamable"}
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void parchear({ llamable: !d.llamable }, "llamable")}
                  disabled={ocupado === "llamable"}
                  className={BOTON_SEC}
                >
                  <Ban size={14} />
                  {d.llamable ? "No llamar" : "Reactivar"}
                </button>
                <button
                  type="button"
                  onClick={() => void parchear({ estado: "legal" }, "legal")}
                  disabled={ocupado === "legal" || d.estado === "legal"}
                  className={BOTON_SEC}
                >
                  <FileText size={14} />
                  Pasar a legal
                </button>
              </div>

              <div className="mt-3">
                <textarea
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  rows={2}
                  placeholder="Anotar algo de esta cuenta"
                  className={cn(CAMPO, "resize-none")}
                />
                <button
                  type="button"
                  onClick={() => {
                    void parchear({ nota }, "nota").then(() => setNota(""));
                  }}
                  disabled={!nota.trim() || ocupado === "nota"}
                  className={cn(BOTON_SEC, "mt-2 w-full")}
                >
                  <StickyNote size={14} /> Guardar nota
                </button>
              </div>
            </div>
          </div>

          {/* Columna derecha: el historial */}
          <div className="rounded-2xl border border-line bg-card shadow-sm">
            <div className="border-b border-line px-4 py-3">
              <p className="text-[13.5px] font-extrabold tracking-tight text-[var(--text)]">
                Historial de gestión
              </p>
              <p className="text-[12px] text-[var(--text-3)]">
                {d.intentos} llamada{d.intentos === 1 ? "" : "s"} · {d.gestiones.length} movimiento
                {d.gestiones.length === 1 ? "" : "s"}
              </p>
            </div>

            {d.gestiones.length === 0 && (
              <p className="px-4 py-10 text-center text-[13px] text-[var(--text-3)]">
                Esta cuenta todavía no se ha gestionado.
              </p>
            )}

            <ul className="divide-y divide-line">
              {d.gestiones.map((g) => {
                const Icon = ICONO_GESTION[g.tipo];
                const abierto = abierta === g.id;
                return (
                  <li key={g.id} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-2)]">
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {g.resultado && <ResultadoPill resultado={g.resultado} />}
                          <span className="text-[11.5px] text-[var(--text-3)]">
                            {fechaHora(g.cuando)}
                            {g.duracionSeg ? ` · ${duracion(g.duracionSeg)}` : ""}
                            {g.autor === "ia" ? " · agente de voz" : g.autor === "gestor" ? " · gestor" : ""}
                          </span>
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-2)]">
                          {g.resumen}
                        </p>

                        {g.transcript && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setAbierta(abierto ? null : g.id)}
                              className="text-[12px] font-semibold text-brand hover:underline"
                            >
                              {abierto ? "Ocultar transcripción" : "Ver transcripción"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void analizar(g.id)}
                              disabled={ocupado === `ia-${g.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[11.5px] font-semibold text-[var(--text-2)] transition hover:bg-surface disabled:opacity-50"
                            >
                              <Sparkles size={12} />
                              {ocupado === `ia-${g.id}` ? "Leyendo la llamada..." : "Analizar con IA"}
                            </button>
                          </div>
                        )}

                        {abierto && g.transcript && (
                          <pre className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-surface p-3 text-[12px] leading-relaxed text-[var(--text-2)]">
                            {g.transcript}
                          </pre>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
