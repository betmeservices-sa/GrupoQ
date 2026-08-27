"use client";

// Cuánto escriben por Messenger e Instagram y de qué hablan.
//
// Es la pregunta que el hotel hace todos los días ("¿cuántos preguntaron por
// el Day Pass?") y que hasta hoy no tenía respuesta en el panel: había
// ocupación y reservas, pero nada de la conversación. Tres cortes: hoy, 7
// días, 30 días. Los números salen de /api/meta/estadisticas, que cuenta en
// hora de El Salvador.

import { useEffect, useState } from "react";
import { Bot, Instagram, Facebook, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/cn";

interface Estadisticas {
  dias: number;
  entrantes: number;
  personas: number;
  porCanal: Record<string, number>;
  porDia: { dia: string; facebook: number; instagram: number }[];
  temas: { id: string; nombre: string; n: number }[];
  respondidos: { ia: number; personas: number; equipo: number };
  sinResponder: number;
}

const PERIODOS: { dias: number; nombre: string }[] = [
  { dias: 1, nombre: "Hoy" },
  { dias: 7, nombre: "7 días" },
  { dias: 30, nombre: "30 días" },
];

function diaCorto(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

export function MensajesRedes() {
  const [dias, setDias] = useState(7);
  const [datos, setDatos] = useState<Estadisticas | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    setCargando(true);
    fetch(`/api/meta/estadisticas?dias=${dias}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Estadisticas & { ok?: boolean }) => {
        if (vivo && d.ok !== false) setDatos(d);
      })
      .catch(() => {})
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [dias]);

  const maxDia = Math.max(1, ...(datos?.porDia.map((d) => d.facebook + d.instagram) ?? [1]));
  const maxTema = Math.max(1, ...(datos?.temas.map((t) => t.n) ?? [1]));
  const respondidas = (datos?.respondidos.ia ?? 0) + (datos?.respondidos.personas ?? 0) + (datos?.respondidos.equipo ?? 0);

  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--text)]">Mensajes por redes</h2>
          <p className="text-[12.5px] text-[var(--text-3)]">Messenger e Instagram · lo que entra y de qué hablan</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              type="button"
              onClick={() => setDias(p.dias)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition",
                dias === p.dias ? "bg-brand text-white shadow-sm" : "text-[var(--text-2)] hover:bg-card",
              )}
            >
              {p.nombre}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4", cargando && "opacity-60")}>
        <Cifra Icon={MessageSquare} valor={datos?.entrantes ?? 0} label="Mensajes recibidos" />
        <Cifra Icon={Users} valor={datos?.personas ?? 0} label="Personas distintas" />
        <Cifra
          Icon={Bot}
          valor={respondidas}
          label={`Respuestas · ${datos?.respondidos.ia ?? 0} de la IA, ${(datos?.respondidos.personas ?? 0) + (datos?.respondidos.equipo ?? 0)} del equipo`}
        />
        <Cifra Icon={MessageSquare} valor={datos?.sinResponder ?? 0} label="Conversaciones sin responder" alerta={(datos?.sinResponder ?? 0) > 0} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* Por día, apilado por canal */}
        <div>
          <div className="mb-2 flex items-center gap-3 text-[11.5px] text-[var(--text-3)]">
            <span className="inline-flex items-center gap-1"><Facebook size={12} className="text-[#1877f2]" /> Facebook · {datos?.porCanal.facebook ?? 0}</span>
            <span className="inline-flex items-center gap-1"><Instagram size={12} className="text-[#e1306c]" /> Instagram · {datos?.porCanal.instagram ?? 0}</span>
          </div>
          <div className="flex h-36 items-end gap-1">
            {(datos?.porDia ?? []).map((d) => {
              const total = d.facebook + d.instagram;
              return (
                <div key={d.dia} className="group relative flex min-w-0 flex-1 flex-col justify-end" title={`${diaCorto(d.dia)}: ${d.facebook} Facebook, ${d.instagram} Instagram`}>
                  <div className="flex flex-col justify-end overflow-hidden rounded-t" style={{ height: `${(total / maxDia) * 100}%` }}>
                    <div className="bg-[#e1306c]/80" style={{ flex: d.instagram }} />
                    <div className="bg-[#1877f2]/80" style={{ flex: d.facebook }} />
                  </div>
                  {(datos?.porDia.length ?? 0) <= 10 && (
                    <span className="mt-1 truncate text-center text-[10px] text-[var(--text-3)]">{diaCorto(d.dia)}</span>
                  )}
                </div>
              );
            })}
          </div>
          {(datos?.porDia.length ?? 0) > 10 && datos && (
            <div className="mt-1 flex justify-between text-[10px] text-[var(--text-3)]">
              <span>{diaCorto(datos.porDia[0].dia)}</span>
              <span>{diaCorto(datos.porDia[datos.porDia.length - 1].dia)}</span>
            </div>
          )}
        </div>

        {/* De qué hablan */}
        <div>
          <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--text-3)]">De qué preguntan</p>
          {datos && datos.temas.length === 0 && (
            <p className="text-[12.5px] text-[var(--text-3)]">Sin mensajes en este periodo.</p>
          )}
          <ul className="space-y-1.5">
            {(datos?.temas ?? []).slice(0, 8).map((t) => (
              <li key={t.id} className="flex items-center gap-3 text-[12.5px]">
                <span className="w-32 shrink-0 truncate text-[var(--text-2)]">{t.nombre}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${(t.n / maxTema) * 100}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right font-semibold text-[var(--text)]">{t.n}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Cifra({
  Icon,
  valor,
  label,
  alerta,
}: {
  Icon: typeof MessageSquare;
  valor: number;
  label: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface/60 px-3.5 py-3">
      <div className="flex items-center gap-2 text-[var(--text-3)]">
        <Icon size={14} />
        <span className="truncate text-[11.5px]">{label}</span>
      </div>
      <p className={cn("mt-1 text-[22px] font-extrabold tracking-tight", alerta ? "text-[#c2410c]" : "text-[var(--text)]")}>{valor}</p>
    </div>
  );
}
