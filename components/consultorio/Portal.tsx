"use client";

// El portal del paciente, en su teléfono.
//
// Una sola pregunta para entrar (el correo con el que se registró) y después
// lo suyo, separado por lo que es. Se pregunta qué quiere ver en vez de tirarle
// todo junto: quien entra acá casi siempre viene por UNA cosa, la receta para
// la farmacia o el código para el laboratorio.
//
// El código va grande y con botón de copiar: es lo que se da en recepción, y
// con él la orden se abre sin marcar nada a mano.

import { useEffect, useState } from "react";
import { Check, Copy, FlaskConical, MapPin, Pill, Scan, Syringe, type LucideIcon } from "lucide-react";
import type {
  OrdenDelPortal,
  Portal as DatosPortal,
  RecetaDelPortal,
  Seccion,
} from "@/lib/consultorio/portal";

const ICONO: Record<Seccion, LucideIcon> = {
  receta: Pill,
  orden: FlaskConical,
  imagen: Scan,
  proceso: Syringe,
};

/** Dónde se da el código, dicho como lo diría la recepción. */
const DONDE: Record<OrdenDelPortal["tipo"], string> = {
  orden: "en el laboratorio",
  imagen: "en imagenología",
  proceso: "en la sala de procedimientos",
};

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString("es-SV", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/El_Salvador",
  });

export function Portal({ clinica }: { clinica: string }) {
  const [correo, setCorreo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datos, setDatos] = useState<DatosPortal | null>(null);
  const [seccion, setSeccion] = useState<Seccion | null>(null);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setBuscando(true);
    setError(null);
    try {
      const r = await fetch("/api/consultorio/publico/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "No se pudo buscar.");
        return;
      }
      const portal = d.portal as DatosPortal;
      setDatos(portal);
      // Con una sola cosa se abre directo: "¿qué querés ver?" con una sola
      // opción es un toque de adorno.
      setSeccion(portal.secciones.length === 1 ? portal.secciones[0].id : null);
    } catch {
      setError("No se pudo buscar: revisá tu conexión.");
    } finally {
      setBuscando(false);
    }
  }

  function otroCorreo() {
    setDatos(null);
    setSeccion(null);
    setError(null);
  }

  const cabecera = (
    <header className="mb-6 text-center">
      <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--texto-3)]">
        {clinica}
      </p>
      <h1 className="mt-1 font-serif text-[26px] leading-tight text-[var(--texto)]">
        Portal del paciente
      </h1>
    </header>
  );

  if (!datos) {
    return (
      <>
        {cabecera}
        <form onSubmit={entrar} className="tarjeta px-5 py-6">
          <label className="block">
            <span className="block font-serif text-[17px] text-[var(--texto)]">Tu correo</span>
            <span className="block text-[13.5px] text-[var(--texto-2)]">
              El mismo que dejaste al registrarte con el doctor
            </span>
            <input
              required
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className="campo mt-2.5"
            />
          </label>
          {error && (
            <p className="mt-3 border-l-2 border-[var(--alerta)] bg-[var(--alerta-clara)] px-3 py-2.5 text-[14px] text-[var(--texto)]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={buscando || !correo.trim()}
            className="boton mt-5 w-full py-3.5 text-[15.5px]"
          >
            {buscando ? "Buscando" : "Ver mis documentos"}
          </button>
        </form>
      </>
    );
  }

  const visibles = seccion ? datos.documentos.filter((d) => d.tipo === seccion) : [];

  return (
    <>
      {cabecera}
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-serif text-[21px] text-[var(--texto)]">
          Hola, {datos.nombre.split(/\s+/)[0]}
        </p>
        <button
          type="button"
          onClick={otroCorreo}
          className="text-[13.5px] text-[var(--verde)] underline-offset-2 hover:underline"
        >
          Usar otro correo
        </button>
      </div>

      {datos.secciones.length === 0 ? (
        <div className="tarjeta px-6 py-9 text-center">
          <p className="font-serif text-[19px] text-[var(--texto)]">Todavía no hay nada tuyo</p>
          <p className="mx-auto mt-1.5 max-w-[34ch] text-[14.5px] leading-relaxed text-[var(--texto-2)]">
            Cuando el doctor te deje una receta o una orden, aparece acá.
          </p>
        </div>
      ) : (
        <>
          {datos.secciones.length > 1 && (
            <section className="mb-5">
              <h2 className="mb-2.5 font-serif text-[16px] text-[var(--texto)]">¿Qué querés ver?</h2>
              <div className="grid grid-cols-2 gap-2.5">
                {datos.secciones.map((s) => {
                  const Icono = ICONO[s.id];
                  const on = seccion === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSeccion(s.id)}
                      aria-pressed={on}
                      className={`tarjeta flex items-center gap-2.5 px-3.5 py-3.5 text-left ${on ? "abierta" : ""}`}
                    >
                      <Icono
                        size={19}
                        className={`shrink-0 ${on ? "text-[var(--verde)]" : "text-[var(--texto-3)]"}`}
                      />
                      <span className="min-w-0 flex-1 font-serif text-[15px] leading-tight text-[var(--texto)]">
                        {s.titulo}
                      </span>
                      <span className="shrink-0 font-mono text-[13px] text-[var(--texto-2)]">
                        {s.cantidad}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <div className="space-y-4">
            {visibles.map((d) =>
              d.tipo === "receta" ? (
                <TarjetaReceta key={d.id} receta={d} varias={datos.varias} />
              ) : (
                <TarjetaOrden key={d.id} orden={d} varias={datos.varias} />
              ),
            )}
          </div>
        </>
      )}
    </>
  );
}

function TarjetaReceta({ receta, varias }: { receta: RecetaDelPortal; varias: boolean }) {
  return (
    <article className="documento px-5 py-5">
      <header className="membrete flex items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <p className="font-serif text-[18px] leading-tight text-[var(--texto)]">Receta médica</p>
          <p className="mt-0.5 text-[13px] text-[var(--texto-2)]">
            {receta.doctor.nombre} · {fechaLarga(receta.fecha)}
          </p>
          {varias && <p className="text-[13px] text-[var(--texto-2)]">Para {receta.paciente}</p>}
        </div>
        <span className="shrink-0 pt-1 font-mono text-[12px] tracking-[0.06em] text-[var(--texto-3)]">
          {receta.codigo}
        </span>
      </header>

      <ol className="mt-4 space-y-3">
        {receta.medicamentos.map((m, i) => {
          const detalle = [m.dosis, m.frecuencia, m.duracion].filter(Boolean).join(" · ");
          return (
            <li key={i} className="flex gap-3">
              <span className="w-5 shrink-0 font-serif text-[15px] text-[var(--texto-3)]">{i + 1}.</span>
              <span className="min-w-0">
                <span className="block font-serif text-[16px] leading-snug text-[var(--texto)]">
                  {m.nombre}
                </span>
                {detalle && (
                  <span className="block text-[13.5px] text-[var(--texto-2)]">{detalle}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {receta.indicaciones && (
        <p className="mt-4 border-t border-[var(--linea)] pt-3 text-[14px] leading-relaxed text-[var(--texto)]">
          {receta.indicaciones}
        </p>
      )}

      <p className="mt-5 text-right text-[12.5px] text-[var(--texto-3)]">
        {receta.doctor.especialidad} · {receta.doctor.registro}
      </p>
    </article>
  );
}

function TarjetaOrden({ orden, varias }: { orden: OrdenDelPortal; varias: boolean }) {
  return (
    <article className="documento px-5 py-5">
      <header className="membrete pb-3">
        <p className="font-serif text-[18px] leading-tight text-[var(--texto)]">{orden.titulo}</p>
        <p className="mt-0.5 text-[13px] text-[var(--texto-2)]">
          {orden.doctor.nombre} · {fechaLarga(orden.fecha)}
        </p>
        {varias && <p className="text-[13px] text-[var(--texto-2)]">Para {orden.paciente}</p>}
      </header>

      <CodigoParaDar codigo={orden.codigo} donde={DONDE[orden.tipo]} />

      <div className="mt-4 space-y-3">
        {orden.grupos.map((g) => (
          <div key={g.area}>
            <p className="border-b border-[var(--linea)] pb-1 font-serif text-[14.5px] text-[var(--texto)]">
              {g.area}
            </p>
            <ul className="mt-1 space-y-0.5">
              {g.estudios.map((e, i) => (
                <li key={i} className="text-[14px] text-[var(--texto-2)]">
                  {e}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {orden.preparacion.length > 0 && (
        <p className="mt-4 border-l-2 border-[var(--ambar)] bg-[var(--ambar-claro)] px-3 py-2.5 text-[14px] leading-relaxed text-[var(--texto)]">
          Preparación: {orden.preparacion.join(", ")}
        </p>
      )}
      {orden.indicaciones && (
        <p className="mt-3 text-[14px] leading-relaxed text-[var(--texto)]">{orden.indicaciones}</p>
      )}

      <div className="mt-4 space-y-2 border-t border-[var(--linea)] pt-3">
        {orden.lugares.map((l) => (
          <p key={l.nombre} className="flex gap-2 text-[13.5px] leading-snug text-[var(--texto-2)]">
            <MapPin size={15} className="mt-0.5 shrink-0 text-[var(--texto-3)]" />
            <span>
              <span className="text-[var(--texto)]">{l.nombre}</span>, {l.direccion}
              <span className="block text-[12.5px] text-[var(--texto-3)]">{l.horario}</span>
            </span>
          </p>
        ))}
      </div>
    </article>
  );
}

function CodigoParaDar({ codigo, donde }: { codigo: string; donde: string }) {
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 1800);
    return () => clearTimeout(t);
  }, [copiado]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
    } catch {
      // Sin permiso del navegador para copiar: el código igual está a la vista.
    }
  }

  return (
    <div className="mt-4 border-l-2 border-[var(--verde)] bg-[var(--verde-claro)] px-4 py-3">
      <p className="text-[13.5px] text-[var(--texto-2)]">Tu código para dar {donde}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <span className="font-mono text-[23px] font-semibold tracking-[0.1em] text-[var(--texto)]">
          {codigo}
        </span>
        <button type="button" onClick={() => void copiar()} className="boton-2">
          {copiado ? <Check size={15} /> : <Copy size={15} />}
          {copiado ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="mt-1 text-[12.5px] text-[var(--texto-2)]">
        Con este código te marcan todo en recepción, sin llenar nada.
      </p>
    </div>
  );
}
