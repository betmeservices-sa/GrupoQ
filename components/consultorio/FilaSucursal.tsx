"use client";

// Lo que hace el paciente al llegar al laboratorio: se registra, marca sus
// exámenes y se queda con su turno.
//
// Todo pasa en el teléfono, de pie, en la entrada. Por eso las áreas de
// exámenes van plegadas: sesenta casillas abiertas de golpe en una pantalla
// chica son cuatro pantallazos de scroll antes de entender qué hay que hacer.
// Se abre la que interesa y se marca ahí.

import { useMemo, useState } from "react";
import { ChevronDown, ClipboardList } from "lucide-react";
import {
  areasDe,
  conLado,
  preparacionDe as preparacion,
  valorTotal,
  type TipoOrden,
} from "@/lib/consultorio/catalogos";
import type { Sucursal } from "@/lib/consultorio/tipos";
import { Turno } from "@/components/consultorio/Turno";

export function FilaSucursal({ sucursal }: { sucursal: Sucursal }) {
  // De qué es esta entrada: exámenes de laboratorio, estudios de imagenología o
  // procedimientos. De eso depende TODO lo que se ve abajo.
  const tipoOrden: TipoOrden =
    sucursal.tipo === "imagenologia" ? "imagen" : sucursal.tipo === "procesos" ? "proceso" : "orden";
  const AREAS = areasDe(tipoOrden);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correo, setCorreo] = useState("");
  const [marcados, setMarcados] = useState<string[]>([]);
  const [abierta, setAbierta] = useState<string | null>(AREAS[0]?.id ?? null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnoId, setTurnoId] = useState<string | null>(null);

  // Quien viene referido trae el código de su orden. Con eso no hay que marcar
  // nada a mano: se traen los exámenes que le dejó el doctor y solo confirma.
  const [codigo, setCodigo] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [orden, setOrden] = useState<{ doctor: string; examenes: string[] } | null>(null);
  const [errorOrden, setErrorOrden] = useState<string | null>(null);

  async function traerOrden() {
    const c = codigo.trim().toUpperCase();
    if (!c) return;
    setBuscando(true);
    setErrorOrden(null);
    try {
      const r = await fetch(`/api/consultorio/publico/orden/${encodeURIComponent(c)}`, {
        cache: "no-store",
      });
      const d = await r.json();
      if (!d.ok) {
        setErrorOrden(d.error ?? "No encontramos esa orden.");
        setOrden(null);
      } else if (d.examenes.length === 0) {
        setErrorOrden("Esa orden no trae nada que se haga acá.");
        setOrden(null);
      } else {
        if (d.tipo !== tipoOrden) {
          setErrorOrden("Esa orden no es de acá: es de otro departamento de la clínica.");
          setOrden(null);
          setBuscando(false);
          return;
        }
        setOrden({ doctor: d.doctor, examenes: d.examenes });
        setMarcados(d.examenes);
        if (!nombre && d.nombre) setNombre(d.nombre);
        // Se abre el área del primer examen para que se vea que quedó marcado
        // y no parezca que no pasó nada.
        const area = AREAS.find((a) => a.examenes.some((e) => e.id === d.examenes[0]));
        if (area) setAbierta(area.id);
      }
    } catch {
      setErrorOrden("No se pudo buscar: revisá tu conexión.");
    }
    setBuscando(false);
  }

  const avisos = useMemo(() => preparacion(marcados), [marcados]);

  function marcar(id: string) {
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch("/api/consultorio/publico/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: sucursal.codigo, nombre, telefono, correo, examenes: marcados }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "No se pudo tomar el turno.");
        setEnviando(false);
        return;
      }
      setTurnoId(d.turnoId);
    } catch {
      setError("No se pudo tomar el turno: revisá tu conexión.");
      setEnviando(false);
    }
  }

  if (turnoId) return <Turno turnoId={turnoId} examenes={marcados} />;

  return (
    <form onSubmit={enviar} className="space-y-6">
      <section className="tarjeta px-5 py-5">
        <h2 className="font-serif text-[18px] text-[var(--texto)]">
          ¿Traés orden de tu doctor?
        </h2>
        <p className="mt-0.5 text-[13.5px] leading-relaxed text-[var(--texto-2)]">
          Escribí el código que aparece en ella y te marcamos los exámenes.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void traerOrden();
              }
            }}
            placeholder="ABCDE-123456"
            className="campo w-[190px] font-mono tracking-[0.08em]"
          />
          <button
            type="button"
            onClick={() => void traerOrden()}
            disabled={buscando || codigo.trim().length < 6}
            className="boton-2"
          >
            {buscando ? "Buscando" : "Confirmar"}
          </button>
        </div>
        {errorOrden && (
          <p className="mt-2 text-[13.5px] text-[var(--alerta)]">{errorOrden}</p>
        )}
        {orden && (
          <div className="mt-3 border-l-2 border-[var(--verde)] bg-[var(--verde-claro)] px-4 py-3">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--verde-hondo)]">
              <ClipboardList size={16} />
              {orden.examenes.length} {orden.examenes.length === 1 ? "examen" : "exámenes"} de{" "}
              {orden.doctor}
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--texto-2)]">
              {orden.examenes.map((e) => conLado(e)).join(", ")}
            </p>
            <p className="mt-1.5 text-[12.5px] text-[var(--texto-3)]">
              Ya quedaron marcados abajo. Si querés agregar algo más, marcalo ahí.
            </p>
          </div>
        )}
      </section>

      <section className="tarjeta px-5 py-5">
        <h2 className="font-serif text-[18px] text-[var(--texto)]">Tus datos</h2>
        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="block text-[14px] font-medium text-[var(--texto)]">
              Nombre completo
            </span>
            <input
              required
              autoComplete="name"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="campo mt-1.5"
            />
          </label>
          <label className="block">
            <span className="block text-[14px] font-medium text-[var(--texto)]">Teléfono</span>
            <input
              required
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="7777 7777"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="campo mt-1.5"
            />
          </label>
          <label className="block">
            <span className="block text-[14px] font-medium text-[var(--texto)]">
              Correo <span className="text-[var(--texto-3)]">opcional</span>
            </span>
            <span className="block text-[13px] text-[var(--texto-2)]">
              Ahí te mandamos los resultados
            </span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              className="campo mt-1.5"
            />
          </label>
        </div>
      </section>

      <section className="tarjeta overflow-hidden">
        <div className="border-b border-[var(--linea)] px-5 py-4">
          <h2 className="font-serif text-[18px] text-[var(--texto)]">
            {tipoOrden === "imagen"
              ? "¿Qué estudio te vas a hacer?"
              : tipoOrden === "proceso"
                ? "¿Qué te van a hacer?"
                : "¿Qué exámenes te vas a hacer?"}
          </h2>
          <p className="mt-0.5 text-[13.5px] text-[var(--texto-2)]">
            Si traés una orden del doctor, marcá lo que dice ahí.
          </p>
        </div>

        <div className="divide-y divide-[var(--linea)]">
          {AREAS.map((a) => {
            const n = a.examenes.filter((e) => marcados.includes(e.id)).length;
            const on = abierta === a.id;
            return (
              <div key={a.id}>
                <button
                  type="button"
                  onClick={() => setAbierta(on ? null : a.id)}
                  aria-expanded={on}
                  className="flex w-full items-center gap-3 px-5 py-3.5 text-left"
                >
                  <span className="flex-1 font-serif text-[16px] text-[var(--texto)]">
                    {a.nombre}
                  </span>
                  {n > 0 && <span className="chip chip-verde">{n}</span>}
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-[var(--texto-3)] transition-transform duration-200 ${
                      on ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {on && (
                  <div className="px-3 pb-3 sm:columns-2">
                    {a.examenes.map((e) => (
                      <label key={e.id} className="casilla break-inside-avoid">
                        <input
                          type="checkbox"
                          checked={marcados.includes(e.id)}
                          onChange={() => marcar(e.id)}
                        />
                        <span className="min-w-0 flex-1 text-[14.5px] leading-snug text-[var(--texto)]">
                          {e.nombre}
                          {e.nota && (
                            <span className="block text-[12.5px] text-[var(--texto-3)]">
                              {e.nota}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono text-[12.5px] text-[var(--texto-3)]">
                          {e.estimado ? "~" : ""}${e.precio}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {avisos.length > 0 && (
        <p className="border-l-2 border-[var(--ambar)] bg-[var(--ambar-claro)] px-4 py-3 text-[14px] leading-relaxed text-[var(--texto)]">
          Para lo que marcaste necesitás {avisos.join(", ")}. Si no venís así, decilo en el
          mostrador antes de tomar turno.
        </p>
      )}

      {error && (
        <p className="border-l-2 border-[var(--alerta)] bg-[var(--alerta-clara)] px-4 py-3 text-[14px] text-[var(--texto)]">
          {error}
        </p>
      )}

      {/* Pegado abajo: la lista de exámenes es larga y el botón tiene que estar
          donde la mano ya está, no al final del recorrido. */}
      <div className="sticky bottom-0 -mx-4 border-t border-[var(--linea-2)] bg-[var(--panel)]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[13.5px] text-[var(--texto-2)]">
            {marcados.length === 0
              ? "Marcá lo que te vas a hacer"
              : `${marcados.length} ${marcados.length === 1 ? "estudio" : "estudios"} · $${valorTotal(marcados)}`}
          </span>
          <button
            type="submit"
            disabled={enviando || marcados.length === 0}
            className="boton px-6 py-3 text-[15px]"
          >
            {enviando ? "Tomando turno" : "Tomar turno"}
          </button>
        </div>
      </div>
    </form>
  );
}
