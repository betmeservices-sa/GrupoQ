"use client";

// La reportería del gerente de ventas.
//
// Responde, en este orden, lo que un gerente pregunta cada mañana: qué se me
// está venciendo, quién no ha tomado lo suyo, cuánta gente está trabada en
// papeles y por qué, cuánto se cerró y cuánto tarda el proceso. Los números de
// "ahora" y los del periodo van separados y rotulados: son preguntas distintas.

import { useMemo, useState } from "react";
import { AlertTriangle, Clock, FileWarning, Trophy, UserX } from "lucide-react";
import { cn } from "@/lib/cn";
import { telefonoBonito } from "@/lib/phone";
import { HORAS_AVISO, HORAS_VENCIDO } from "@/lib/ventas-pipeline";
import type { Vendedor } from "@/lib/ventas-pipeline";
import type { Caso, RespuestaReporte } from "./tipos";
import { Dona, Embudo, LineaActividad } from "./Graficos";

// El color de cada documento. Orden FIJO: la paleta se valido con el script de
// la guia en ese orden de adyacencia. Si se agrega un quinto documento hay que
// volver a correr el validador, no elegir un tono a ojo.
const COLOR_DOC: Record<string, string> = {
  dui: "#3B82F6",
  salario: "#059669",
  recibo: "#D97706",
  referencias: "#DB2777",
};

function horas(n: number | null): string {
  if (n === null) return "sin datos";
  if (n < 1) return `${Math.round(n * 60)} min`;
  if (n < 48) return `${n} h`;
  return `${Math.round((n / 24) * 10) / 10} días`;
}

function nombreCorto(vendedores: Vendedor[], id: string | null): string {
  if (!id) return "sin asignar";
  return vendedores.find((v) => v.id === id)?.nombre ?? id;
}

export function ReporteGerente({ r, casos = [] }: { r: RespuestaReporte; casos?: Caso[] }) {
  // La etapa abierta en el embudo. Null = ninguna, y ahi no se muestra texto.
  const [etapaAbierta, setEtapaAbierta] = useState<string | null>(null);

  // Leads nuevos por dia. Sale de la fecha de creacion de cada caso, no de un
  // agregado del servidor: asi la linea y el tablero no pueden discrepar.
  const porDia = useMemo(() => {
    const clave = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const cuenta = new Map<string, number>();
    for (const c of casos) {
      const d = new Date(c.creado);
      if (Number.isNaN(d.getTime())) continue;
      d.setHours(0, 0, 0, 0);
      cuenta.set(clave(d), (cuenta.get(clave(d)) ?? 0) + 1);
    }
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(hoy.getTime() - (29 - i) * 86400000);
      return { dia: clave(d), cantidad: cuenta.get(clave(d)) ?? 0 };
    });
  }, [casos]);

  const enEtapa = useMemo(
    () => (etapaAbierta ? casos.filter((c) => c.etapa === etapaAbierta) : []),
    [casos, etapaAbierta],
  );
  const vendedores = r.vendedores.map((v) => ({ id: v.id, nombre: v.nombre, iniciales: v.iniciales }));
  const enEmbudo = r.embudo.filter((e) => e.etapa !== "cerrado").reduce((n, e) => n + e.n, 0);
  const vencidos = r.alertas.filter((a) => a.nivel === "vencido").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tarjeta
          Icon={AlertTriangle}
          alarma={r.alertas.length > 0}
          valor={r.alertas.length}
          label={`Sin tomar a tiempo (${HORAS_AVISO} h)`}
          pie={vencidos > 0 ? `${vencidos} pasaron las ${HORAS_VENCIDO} h` : "ninguno vencido"}
        />
        <Tarjeta
          Icon={FileWarning}
          valor={r.embudo.find((e) => e.etapa === "documentacion")?.n ?? 0}
          label="Pendientes de documentación"
          pie={`${r.documentos.porRevisar} con papeles por revisar`}
        />
        <Tarjeta
          Icon={UserX}
          valor={r.sinAsignar}
          label="Completos sin vendedor"
          pie={r.sinAsignar > 0 ? "hay que repartirlos" : "todos repartidos"}
        />
        <Tarjeta
          Icon={Trophy}
          valor={r.movimiento.ventas}
          label={`Ventas · ${r.periodo.etiqueta.toLowerCase()}`}
          pie={
            r.movimiento.tasaCierre === null
              ? "sin cierres en el periodo"
              : `${r.movimiento.tasaCierre}% de lo cerrado · antes ${r.anterior.ventas}`
          }
        />
      </div>

      {r.alertas.length > 0 && (
        <section className="rounded-2xl border border-[var(--brand-red)]/40 bg-[var(--brand-red)]/5 p-4">
          <h3 className="flex items-center gap-2 text-[14px] font-bold text-[var(--text)]">
            <AlertTriangle size={15} className="text-[var(--brand-red)]" />
            Esperando que un vendedor los tome
          </h3>
          <table className="mt-2 w-full text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--text-3)]">
              <tr className="text-left">
                <th className="py-1 pr-3 font-semibold">Prospecto</th>
                <th className="py-1 pr-3 font-semibold">Vendedor</th>
                <th className="py-1 pr-3 text-right font-semibold">Esperando</th>
                <th className="py-1 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {r.alertas.map((a) => (
                <tr key={a.telefono} className="border-t border-line">
                  <td className="py-1.5 pr-3">
                    <span className="font-semibold text-[var(--text)]">{a.nombre}</span>
                    <span className="block text-[11px] text-[var(--text-3)]">{telefonoBonito(a.telefono)}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-[var(--text-2)]">{nombreCorto(vendedores, a.vendedor)}</td>
                  <td className="py-1.5 pr-3 text-right font-semibold text-[var(--text-2)]">{a.horas} h</td>
                  <td className="py-1.5">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        a.nivel === "vencido"
                          ? "bg-[var(--brand-red)]/15 text-[var(--brand-red)]"
                          : "bg-amber-50 text-amber-700",
                      )}
                    >
                      {a.nivel === "vencido" ? "Vencido, reasignar" : "Pasó las 48 h"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-card p-4">
        <h3 className="text-[14px] font-bold text-[var(--text)]">Por vendedor</h3>
        <p className="text-[12px] text-[var(--text-3)]">
          Lo de la izquierda es ahora mismo; lo de la derecha, {r.periodo.etiqueta.toLowerCase()}.
        </p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-[11px] uppercase tracking-wide text-[var(--text-3)]">
              <tr className="text-left">
                <th className="py-1.5 pr-3 font-semibold">Vendedor</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Activos</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Sin tomar</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Vencidos</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Tarda en tomar</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Asignados</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Ventas</th>
                <th className="py-1.5 text-right font-semibold">Cierre</th>
              </tr>
            </thead>
            <tbody>
              {r.vendedores.map((v) => (
                <tr key={v.id} className="border-t border-line">
                  <td className="py-2 pr-3 font-semibold text-[var(--text)]">{v.nombre}</td>
                  <td className="py-2 pr-3 text-right text-[var(--text-2)]">{v.activos}</td>
                  <td className={cn("py-2 pr-3 text-right", v.sinTomar > 0 ? "font-semibold text-[var(--text)]" : "text-[var(--text-2)]")}>
                    {v.sinTomar}
                  </td>
                  <td className={cn("py-2 pr-3 text-right", v.vencidos > 0 ? "font-bold text-[var(--brand-red)]" : "text-[var(--text-2)]")}>
                    {v.vencidos}
                  </td>
                  <td className="py-2 pr-3 text-right text-[var(--text-2)]">{horas(v.horasEnTomar)}</td>
                  <td className="py-2 pr-3 text-right text-[var(--text-2)]">{v.asignados}</td>
                  <td className="py-2 pr-3 text-right text-[var(--text-2)]">
                    {v.ventas}
                    {v.perdidos > 0 && <span className="text-[var(--text-3)]"> / {v.perdidos} perdidos</span>}
                  </td>
                  <td className="py-2 text-right text-[var(--text-2)]">{v.tasaCierre === null ? "·" : `${v.tasaCierre}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-4">
          <h3 className="text-[14px] font-bold text-[var(--text)]">Dónde está trabada la documentación</h3>
          {r.documentos.faltantes.length === 0 ? (
            <p className="mt-1 text-[12.5px] text-[var(--text-3)]">Nadie debe papeles ahora mismo.</p>
          ) : (
            <>
              <p className="mt-0.5 text-[12px] text-[var(--text-3)]">Cuántas personas deben cada documento</p>
              <ul className="mt-2 space-y-1.5">
                {r.documentos.faltantes.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-[12.5px]">
                    <span className="w-44 shrink-0 text-[var(--text-2)]">{f.nombre}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                      <span
                        className="block h-full rounded-full bg-brand/70"
                        style={{ width: `${Math.round((f.n / Math.max(...r.documentos.faltantes.map((x) => x.n))) * 100)}%` }}
                      />
                    </span>
                    <span className="w-6 text-right font-semibold text-[var(--text)]">{f.n}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {r.documentos.rechazos.length > 0 && (
            <>
              <p className="mt-3 text-[12px] font-semibold text-[var(--text-2)]">Por qué se devuelven</p>
              <ul className="mt-1 space-y-0.5 text-[12.5px] text-[var(--text-3)]">
                {r.documentos.rechazos.map((x) => (
                  <li key={x.motivo}>
                    {x.nombre} · {x.n}
                  </li>
                ))}
              </ul>
            </>
          )}

          {r.documentos.subEstados.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {r.documentos.subEstados.map((s) => (
                <span key={s.sub} className="rounded-full border border-line bg-surface px-2 py-0.5 text-[11.5px] text-[var(--text-2)]">
                  {s.nombre} · {s.n}
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-card p-4">
          <h3 className="text-[14px] font-bold text-[var(--text)]">Dónde está la gente</h3>
          <p className="mb-3 text-[12px] text-[var(--text-3)]">
            Tocá una etapa para ver quiénes están ahí.
          </p>
          <Embudo
            pasos={r.embudo.map((e) => ({ etapa: e.nombre, cantidad: e.n }))}
            seleccion={
              etapaAbierta ? (r.embudo.find((e) => e.etapa === etapaAbierta)?.nombre ?? null) : null
            }
            onSeleccion={(nombre) => {
              const id = r.embudo.find((e) => e.nombre === nombre)?.etapa ?? null;
              setEtapaAbierta((v) => (v === id ? null : id));
            }}
          />

          {/* El texto aparece SOLO cuando alguien abre una etapa. */}
          {etapaAbierta && (
            <div className="mt-3 rounded-xl border border-brand/40 bg-surface p-3">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-[12.5px] font-bold text-[var(--text)]">
                  {r.embudo.find((e) => e.etapa === etapaAbierta)?.nombre}
                </p>
                <button
                  type="button"
                  onClick={() => setEtapaAbierta(null)}
                  className="text-[11px] font-semibold text-[var(--text-3)] hover:text-[var(--text)]"
                >
                  Cerrar
                </button>
              </div>
              <p className="mb-2 text-[11.5px] text-[var(--text-3)]">
                {r.embudo.find((e) => e.etapa === etapaAbierta)?.ayuda}
              </p>
              {enEtapa.length === 0 ? (
                <p className="text-[12px] text-[var(--text-3)]">No hay nadie en esta etapa.</p>
              ) : (
                <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                  {enEtapa.map((c) => (
                    <li
                      key={c.telefono}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-card px-2.5 py-1.5 text-[12px]"
                    >
                      <span className="font-semibold text-[var(--text)]">{c.nombre}</span>
                      <span className="text-[var(--text-3)]">{telefonoBonito(c.telefono)}</span>
                      {c.vehiculo && (
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                          {c.vehiculo}
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-[var(--text-3)]">
                        {c.doc.resumen}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-card p-4">
          <h3 className="mb-3 text-[14px] font-bold text-[var(--text)]">Qué documento falta</h3>
          <Dona
            datos={r.documentos.faltantes
              .filter((d) => d.n > 0)
              .map((d) => ({
                nombre: d.nombre,
                valor: d.n,
                color: COLOR_DOC[d.id] ?? "#6B7280",
              }))}
          />
        </section>

        <section className="rounded-2xl border border-line bg-card p-4 lg:col-span-2">
          <h3 className="text-[14px] font-bold text-[var(--text)]">Leads nuevos por día</h3>
          <p className="mb-2 text-[12px] text-[var(--text-3)]">Últimos 30 días.</p>
          <LineaActividad puntos={porDia} />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <h4 className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--text-2)]">
                <Clock size={12} /> Cuánto tarda el proceso
              </h4>
              <ul className="mt-1.5 flex flex-col gap-1">
                {[
                  ["A expediente completo", r.tiempos.aExpedienteCompleto],
                  ["A primer contacto", r.tiempos.aPrimerContacto],
                  ["A cierre", r.tiempos.aCierre],
                ].map(([txt, v]) => (
                  <li key={txt as string} className="flex items-center gap-2 text-[12px]">
                    <span className="w-36 shrink-0 text-[var(--text-3)]">{txt as string}</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                      <span
                        className="block h-full rounded-full bg-brand/70"
                        style={{
                          width: `${Math.min(100, ((v as number | null) ?? 0) / 1.2)}%`,
                        }}
                      />
                    </span>
                    <span className="w-16 shrink-0 text-right font-semibold text-[var(--text)]">
                      {horas(v as number | null)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-[12px] font-semibold text-[var(--text-2)]">
                Movimiento de {r.periodo.etiqueta.toLowerCase()}
              </h4>
              <ul className="mt-1.5 flex flex-col gap-1">
                {[
                  ["Entraron", r.movimiento.nuevos, r.anterior.nuevos],
                  ["Completaron expediente", r.movimiento.completados, r.anterior.completados],
                  ["Ventas", r.movimiento.ventas, r.anterior.ventas],
                ].map(([txt, ahora, antes]) => {
                  const a = ahora as number;
                  const b = antes as number;
                  const dif = a - b;
                  return (
                    <li key={txt as string} className="flex items-center gap-2 text-[12px]">
                      <span className="w-36 shrink-0 text-[var(--text-3)]">{txt as string}</span>
                      <span className="flex-1 text-right text-[15px] font-extrabold text-[var(--text)]">
                        {a}
                      </span>
                      <span
                        className={cn(
                          "w-16 shrink-0 text-right text-[11px] font-semibold",
                          dif > 0
                            ? "text-[#2f9e2f]"
                            : dif < 0
                              ? "text-[var(--brand-red)]"
                              : "text-[var(--text-3)]",
                        )}
                      >
                        {dif === 0 ? "igual" : `${dif > 0 ? "+" : ""}${dif}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {r.estancados.length > 0 && (
        <section className="rounded-2xl border border-line bg-card p-4">
          <h3 className="text-[14px] font-bold text-[var(--text)]">Expedientes enfriándose</h3>
          <p className="text-[12px] text-[var(--text-3)]">Sin un solo movimiento en tres días o más</p>
          <ul className="mt-2 space-y-1">
            {r.estancados.map((e) => (
              <li key={e.telefono} className="flex flex-wrap items-baseline gap-x-2 text-[12.5px]">
                <span className="font-semibold text-[var(--text)]">{e.nombre}</span>
                <span className="text-[var(--text-3)]">{e.resumen}</span>
                <span className="ml-auto text-[var(--text-2)]">{e.dias} días</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tarjeta({
  Icon,
  valor,
  label,
  pie,
  alarma,
}: {
  Icon: typeof Clock;
  valor: number;
  label: string;
  pie: string;
  alarma?: boolean;
}) {
  return (
    <div className={cn("rounded-2xl border bg-card p-4", alarma ? "border-[var(--brand-red)]/50" : "border-line")}>
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-xl",
          alarma ? "bg-[var(--brand-red)]/10 text-[var(--brand-red)]" : "bg-brand/10 text-brand",
        )}
      >
        <Icon size={16} />
      </span>
      <p className="mt-2.5 text-[24px] font-extrabold leading-none tracking-tight text-[var(--text)]">{valor}</p>
      <p className="mt-1 text-[12.5px] font-medium text-[var(--text-2)]">{label}</p>
      <p className="text-[11.5px] text-[var(--text-3)]">{pie}</p>
    </div>
  );
}
