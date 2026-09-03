"use client";

// La ficha del prospecto: el expediente y lo que se puede hacer con él.
//
// Es donde de verdad se trabaja el caso. Cada documento se marca recibido,
// aprobado o devuelto (con el motivo, que es lo que después se reporta), y en
// cuanto los cuatro quedan aprobados el caso salta solo a un vendedor: por eso
// acá no hay botón de "mover de etapa". La etapa es consecuencia, no una
// decisión suelta.

import { useState } from "react";
import { Check, Clock, RotateCcw, Trophy, UserCheck, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { telefonoBonito } from "@/lib/phone";
import { ETAPA, MOTIVOS_RECHAZO, nombreDeMotivo, type EstadoDoc, type MotivoRechazo, type Vendedor } from "@/lib/ventas-pipeline";
import type { Caso, EventoCaso } from "./tipos";

const NOMBRE_EVENTO: Record<string, string> = {
  creado: "Entró el lead",
  contactado: "Se le contactó",
  documentos_pedidos: "Se le pidió la documentación",
  doc_recibido: "Recibido",
  doc_aprobado: "Aprobado",
  doc_rechazado: "Devuelto",
  completado: "Expediente completo",
  asignado: "Asignado",
  reasignado: "Reasignado",
  tomado: "El vendedor lo tomó",
  cerrado: "Cerrado",
  aviso_gerente: "Aviso al gerente",
  vencido: "Vencido",
};

const COLOR_DOC: Record<EstadoDoc, string> = {
  falta: "border-line bg-surface text-[var(--text-3)]",
  recibido: "border-[var(--brand-accent)]/40 bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]",
  aprobado: "border-emerald-300/60 bg-emerald-50 text-[#2f9e2f]",
  rechazado: "border-[var(--brand-red)]/40 bg-[var(--brand-red)]/10 text-[var(--brand-red)]",
};

const ETIQUETA_DOC: Record<EstadoDoc, string> = {
  falta: "Falta",
  recibido: "Recibido, sin revisar",
  aprobado: "Aprobado",
  rechazado: "Devuelto",
};

function fecha(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-SV", {
    timeZone: "America/El_Salvador",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function FichaCaso({
  caso,
  eventos,
  vendedores,
  ocupado,
  onAccion,
  onCerrar,
}: {
  caso: Caso;
  eventos: EventoCaso[];
  vendedores: Vendedor[];
  ocupado: boolean;
  onAccion: (cuerpo: Record<string, unknown>) => void;
  onCerrar: () => void;
}) {
  const [devolviendo, setDevolviendo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState<MotivoRechazo>("ilegible");
  const [nota, setNota] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [motivoCierre, setMotivoCierre] = useState("");

  const vendedor = vendedores.find((v) => v.id === caso.vendedor);
  const nombre = caso.nombre || telefonoBonito(caso.telefono);

  return (
    <aside className="flex h-full w-full flex-col border-l border-line bg-card md:w-[26rem]">
      <header className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--text)]">{nombre}</h2>
          <p className="text-[12px] text-[var(--text-3)]">
            {telefonoBonito(caso.telefono)}
            {caso.vehiculo ? ` · ${caso.vehiculo}` : ""}
          </p>
          <p className="mt-1 inline-flex rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
            {ETAPA[caso.etapa].nombre}
          </p>
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg border border-line p-1.5 text-[var(--text-3)] transition hover:bg-surface"
          aria-label="Cerrar ficha"
        >
          <X size={15} />
        </button>
      </header>

      <div className={cn("flex-1 space-y-4 overflow-y-auto p-4", ocupado && "opacity-60")}>
        <section>
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Expediente</h3>
            <span className="text-[12px] font-semibold text-[var(--text-2)]">
              {caso.doc.aprobados} de {caso.doc.total}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--text-3)]">{caso.doc.resumen}</p>

          <ul className="mt-2 space-y-2">
            {caso.documentos.map((d) => (
              <li key={d.id} className={cn("rounded-xl border p-2.5", COLOR_DOC[d.estado])}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">{d.nombre}</p>
                    <p className="text-[11px] opacity-80">
                      {ETIQUETA_DOC[d.estado]}
                      {d.estado === "rechazado" ? ` · ${nombreDeMotivo(d.motivo)}` : ""}
                      {d.ts ? ` · ${fecha(d.ts)}` : ""}
                    </p>
                    {d.nota && <p className="mt-0.5 text-[11px] italic opacity-80">{d.nota}</p>}
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.estado !== "recibido" && d.estado !== "aprobado" && (
                    <Boton onClick={() => onAccion({ accion: "documento", documento: d.id, estado: "recibido" })}>
                      Lo mandó
                    </Boton>
                  )}
                  {d.estado !== "aprobado" && (
                    <Boton onClick={() => onAccion({ accion: "documento", documento: d.id, estado: "aprobado" })}>
                      <Check size={12} /> Aprobar
                    </Boton>
                  )}
                  {d.estado !== "falta" && (
                    <Boton onClick={() => setDevolviendo(devolviendo === d.id ? null : d.id)}>Devolver</Boton>
                  )}
                  {d.estado !== "falta" && (
                    <Boton onClick={() => onAccion({ accion: "documento", documento: d.id, estado: "falta" })}>
                      Quitar
                    </Boton>
                  )}
                </div>

                {devolviendo === d.id && (
                  <div className="mt-2 space-y-1.5 rounded-lg bg-card p-2">
                    <select
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value as MotivoRechazo)}
                      className="w-full rounded-lg border border-line bg-card px-2 py-1.5 text-[12px] text-[var(--text)]"
                    >
                      {MOTIVOS_RECHAZO.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nombre}
                        </option>
                      ))}
                    </select>
                    <input
                      value={nota}
                      onChange={(e) => setNota(e.target.value)}
                      placeholder="Qué hay que corregir (opcional)"
                      className="w-full rounded-lg border border-line bg-card px-2 py-1.5 text-[12px] text-[var(--text)] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onAccion({ accion: "documento", documento: d.id, estado: "rechazado", motivo, nota: nota.trim() || null });
                        setDevolviendo(null);
                        setNota("");
                      }}
                      className="w-full rounded-lg bg-[var(--brand-red)] px-2 py-1.5 text-[12px] font-semibold text-white"
                    >
                      Devolver y volver a pedirlo
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Vendedor</h3>
          <p className="mt-0.5 text-[13px] text-[var(--text-2)]">
            {vendedor ? vendedor.nombre : "sin asignar"}
            {caso.asignado && vendedor ? ` · desde ${fecha(caso.asignado)}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vendedores.map((v) => (
              <Boton
                key={v.id}
                activo={v.id === caso.vendedor}
                onClick={() => onAccion({ accion: "asignar", vendedor: v.id })}
              >
                {v.id === caso.vendedor ? <UserCheck size={12} /> : <UserPlus size={12} />}
                {v.nombre.split(" ")[0]}
              </Boton>
            ))}
          </div>
        </section>

        <section className="space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Movimientos</h3>
          <div className="flex flex-wrap gap-1.5">
            {!caso.contactado && <Boton onClick={() => onAccion({ accion: "contactado" })}>Ya se le contactó</Boton>}
            {!caso.pedidos && <Boton onClick={() => onAccion({ accion: "pedir_documentos" })}>Se le pidieron los papeles</Boton>}
            {caso.asignado && !caso.tomado && (
              <Boton onClick={() => onAccion({ accion: "tomar" })}>
                <UserCheck size={12} /> Ya lo contacté
              </Boton>
            )}
            {!caso.cerrado && (
              <>
                <Boton onClick={() => onAccion({ accion: "cerrar", resultado: "venta" })}>
                  <Trophy size={12} /> Venta
                </Boton>
                <Boton onClick={() => setCerrando(!cerrando)}>Perdido</Boton>
              </>
            )}
            {caso.cerrado && (
              <Boton onClick={() => onAccion({ accion: "reabrir" })}>
                <RotateCcw size={12} /> Reabrir
              </Boton>
            )}
          </div>
          {cerrando && !caso.cerrado && (
            <div className="space-y-1.5 rounded-lg border border-line bg-surface p-2">
              <input
                value={motivoCierre}
                onChange={(e) => setMotivoCierre(e.target.value)}
                placeholder="Por qué se perdió"
                className="w-full rounded-lg border border-line bg-card px-2 py-1.5 text-[12px] text-[var(--text)] outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  onAccion({ accion: "cerrar", resultado: "perdido", motivoCierre: motivoCierre.trim() || null });
                  setCerrando(false);
                  setMotivoCierre("");
                }}
                className="w-full rounded-lg border border-line bg-card px-2 py-1.5 text-[12px] font-semibold text-[var(--text-2)]"
              >
                Marcar perdido
              </button>
            </div>
          )}
          {caso.cerrado && (
            <p className="text-[12px] text-[var(--text-3)]">
              {caso.resultado === "venta" ? "Venta" : "Perdido"} el {fecha(caso.cerrado)}
              {caso.motivoCierre ? ` · ${caso.motivoCierre}` : ""}
            </p>
          )}
        </section>

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">Historia</h3>
          <ul className="mt-1.5 space-y-1.5">
            {eventos.length === 0 && <li className="text-[12px] text-[var(--text-3)]">Todavía no hay movimientos.</li>}
            {eventos.map((e, i) => (
              <li key={`${e.ts}-${i}`} className="flex gap-2 text-[12px]">
                <Clock size={12} className="mt-0.5 shrink-0 text-[var(--text-3)]" />
                <span>
                  <span className="font-semibold text-[var(--text-2)]">{NOMBRE_EVENTO[e.tipo] ?? e.tipo}</span>
                  {e.detalle ? ` · ${e.detalle}` : ""}
                  <span className="block text-[11px] text-[var(--text-3)]">{fecha(e.ts)}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  );
}

function Boton({
  children,
  onClick,
  activo,
}: {
  children: React.ReactNode;
  onClick: () => void;
  activo?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11.5px] font-semibold transition",
        activo ? "border-brand bg-brand text-white" : "border-line bg-card text-[var(--text-2)] hover:bg-surface",
      )}
    >
      {children}
    </button>
  );
}
