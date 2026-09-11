"use client";

// El tablero del jefe de laboratorio.
//
// Contesta cuatro preguntas y en ese orden: cuánta gente pasó, cuánto esperó,
// cuánto se facturó y qué se quedó sin hacer. Todo lo demás (las horas pico, el
// ranking de exámenes, la otra sucursal) es para explicar esas cuatro.
//
// El rango se cambia acá y no recargando: los tres ya vienen calculados del
// servidor, así que saltar entre hoy, la semana y el mes es instantáneo.

import { useState } from "react";
import { Clock, DollarSign, TriangleAlert, Users } from "lucide-react";
import type { Barra, Estadisticas, Resumen } from "@/lib/consultorio/estadisticas";
import { Encabezado } from "@/components/consultorio/Encabezado";

const RANGOS = [
  { id: "hoy", nombre: "Hoy" },
  { id: "semana", nombre: "7 días" },
  { id: "mes", nombre: "30 días" },
] as const;

type RangoId = (typeof RANGOS)[number]["id"];

const reloj = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const dinero = (n: number) => `$${n.toLocaleString("en-US")}`;

function Tarjeta({
  Icono,
  titulo,
  valor,
  pie,
  alerta,
}: {
  Icono: typeof Users;
  titulo: string;
  valor: string;
  pie: string;
  alerta?: boolean;
}) {
  return (
    <div className="tarjeta px-5 py-4">
      <p className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--texto-3)]">
        <Icono size={15} strokeWidth={2} />
        {titulo}
      </p>
      <p
        className={`mt-1.5 font-serif text-[34px] leading-none ${
          alerta ? "text-[var(--alerta)]" : "text-[var(--texto)]"
        }`}
      >
        {valor}
      </p>
      <p className="mt-1.5 text-[13px] leading-snug text-[var(--texto-2)]">{pie}</p>
    </div>
  );
}

/** Barras de pie: la carga del día por hora, o los últimos catorce días. */
function Columnas({ datos, titulo, detalle }: { datos: Barra[]; titulo: string; detalle: string }) {
  const tope = Math.max(...datos.map((d) => d.valor), 1);
  return (
    <section className="tarjeta px-5 py-5">
      <h2 className="font-serif text-[17px] text-[var(--texto)]">{titulo}</h2>
      <p className="mt-0.5 text-[13px] text-[var(--texto-2)]">{detalle}</p>
      <div className="mt-5 flex items-end gap-1.5" style={{ height: 148 }}>
        {datos.map((d, i) => (
          <div key={`${d.etiqueta}-${i}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-[11px] font-semibold text-[var(--texto-3)]">{d.valor}</span>
            <div
              className="w-full rounded-t-[3px] bg-[var(--verde)]"
              style={{ height: `${Math.max(2, (d.valor / tope) * 100)}%`, opacity: 0.55 + (d.valor / tope) * 0.45 }}
              title={d.pie ? `${d.etiqueta}: ${d.valor} · ${d.pie}` : `${d.etiqueta}: ${d.valor}`}
            />
            <span className="w-full truncate text-center text-[11px] text-[var(--texto-3)]">
              {d.etiqueta}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Barras acostadas: el ranking, donde lo que importa es el orden. */
function Filas({ datos, titulo, detalle }: { datos: Barra[]; titulo: string; detalle: string }) {
  const tope = Math.max(...datos.map((d) => d.valor), 1);
  return (
    <section className="tarjeta px-5 py-5">
      <h2 className="font-serif text-[17px] text-[var(--texto)]">{titulo}</h2>
      <p className="mt-0.5 text-[13px] text-[var(--texto-2)]">{detalle}</p>
      <ul className="mt-4 space-y-2.5">
        {datos.map((d) => (
          <li key={d.etiqueta}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13.5px] text-[var(--texto)]">{d.etiqueta}</span>
              <span className="shrink-0 text-[13px] text-[var(--texto-2)]">
                {d.valor}
                {d.pie && <span className="text-[var(--texto-3)]"> · {d.pie}</span>}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--panel-2)]">
              <div
                className="h-full rounded-full bg-[var(--verde)]"
                style={{ width: `${(d.valor / tope) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Jefatura({
  datos,
  sucursal,
  escritorio,
}: {
  datos: Estadisticas;
  sucursal: string;
  escritorio?: React.ReactNode;
}) {
  const [rango, setRango] = useState<RangoId>("hoy");
  const r: Resumen = datos[rango];
  const nombreRango = RANGOS.find((x) => x.id === rango)!.nombre.toLowerCase();

  const porPersona = r.atendidos > 0 ? r.ingresos / r.atendidos : 0;
  const pctTarde = r.atendidos > 0 ? Math.round((r.tarde / r.atendidos) * 100) : 0;

  return (
    <>
      <Encabezado titulo="Jefatura" detalle={sucursal}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-[var(--r2)] bg-[var(--panel-2)] p-1">
            {RANGOS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setRango(x.id)}
                className={`rounded-[6px] px-3 py-1.5 text-[13px] transition ${
                  rango === x.id
                    ? "bg-[var(--panel)] font-semibold text-[var(--texto)] shadow-[var(--sombra)]"
                    : "text-[var(--texto-2)] hover:text-[var(--texto)]"
                }`}
              >
                {x.nombre}
              </button>
            ))}
          </div>
          {escritorio}
        </div>
      </Encabezado>

      <div className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Tarjeta
            Icono={Users}
            titulo="Pacientes atendidos"
            valor={String(r.atendidos)}
            pie={`${r.examenes} exámenes · ${(r.examenes / Math.max(1, r.atendidos)).toFixed(1)} por persona`}
          />
          <Tarjeta
            Icono={Clock}
            titulo="Espera promedio"
            valor={reloj(r.espera)}
            pie={`${r.tarde} pasaron de diez minutos (${pctTarde}%)`}
            alerta={r.espera >= 600}
          />
          <Tarjeta
            Icono={DollarSign}
            titulo="Facturado"
            valor={dinero(r.ingresos)}
            pie={`${dinero(Math.round(porPersona))} por paciente`}
          />
          <Tarjeta
            Icono={TriangleAlert}
            titulo="Se fueron incompletos"
            valor={String(r.sinCompletar)}
            pie="Con exámenes de su orden sin hacerse"
            alerta={r.sinCompletar > 0 && r.sinCompletar / Math.max(1, r.atendidos) > 0.1}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {rango === "hoy" ? (
            <Columnas
              datos={datos.porHora}
              titulo="A qué hora llega la gente"
              detalle="La sala se llena apenas abre: los de ayuno llegan antes de entrar a trabajar."
            />
          ) : (
            <Columnas
              datos={datos.porDia}
              titulo="Pacientes por día"
              detalle="Últimas dos semanas. El domingo no se abre."
            />
          )}
          <Filas
            datos={datos.topExamenes}
            titulo="Lo que más se pide"
            detalle={`Exámenes realizados y lo que representan, en ${nombreRango}.`}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Filas
            datos={datos.porArea}
            titulo="Por área"
            detalle="Volumen del mes, para saber dónde hace falta gente."
          />
          <section className="tarjeta px-5 py-5">
            <h2 className="font-serif text-[17px] text-[var(--texto)]">Las dos sucursales</h2>
            <p className="mt-0.5 text-[13px] text-[var(--texto-2)]">Últimos 30 días.</p>
            <table className="mt-4 w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-[var(--linea)] text-left text-[12px] text-[var(--texto-3)]">
                  <th className="pb-2 font-semibold">Sucursal</th>
                  <th className="pb-2 text-right font-semibold">Pacientes</th>
                  <th className="pb-2 text-right font-semibold">Espera</th>
                  <th className="pb-2 text-right font-semibold">Facturado</th>
                </tr>
              </thead>
              <tbody>
                {datos.sucursales.map((s, i) => (
                  <tr key={s.nombre} className={i === 0 ? "" : "text-[var(--texto-2)]"}>
                    <td className="py-2.5 font-serif text-[15px] text-[var(--texto)]">{s.nombre}</td>
                    <td className="py-2.5 text-right">{s.atendidos}</td>
                    <td className="py-2.5 text-right">{reloj(s.espera)}</td>
                    <td className="py-2.5 text-right">{dinero(s.ingresos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 border-t border-[var(--linea)] pt-3 text-[12.5px] leading-relaxed text-[var(--texto-3)]">
              Lo de hoy sale de la fila real: si alguien escanea el QR de la entrada mientras mirás
              esta pantalla, estos números se mueven. El histórico es de demostración.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
