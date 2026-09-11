"use client";

// Los pacientes del doctor, en tabla.
//
// La lista se refresca sola cada cinco segundos y no con un botón, porque el
// caso de uso es tener esta pantalla abierta mientras la gente escanea en la
// sala de espera. Un "actualizar" que hay que acordarse de tocar convierte
// tiempo real en tiempo de acordarse.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Encabezado } from "@/components/consultorio/Encabezado";
import { edad, type Paciente } from "@/lib/consultorio/tipos";

const MINUTO = 60_000;

function haceCuanto(iso: string, ahora: number): string {
  const m = Math.floor((ahora - Date.parse(iso)) / MINUTO);
  if (m < 1) return "recién";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "ayer" : `hace ${d} días`;
}

function iniciales(nombre: string): string {
  const p = nombre.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

const esDeHoy = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

type Conteo = Record<string, { recetas: number; ordenes: number }>;

export function TablaPacientes({
  iniciales: primeros,
  documentos,
  codigo,
  escritorio,
}: {
  iniciales: Paciente[];
  documentos: Conteo;
  codigo: string;
  /** El selector de con cuál doctor se está mirando. Lo arma la página. */
  escritorio?: React.ReactNode;
}) {
  const [pacientes, setPacientes] = useState<Paciente[]>(primeros);
  const [busca, setBusca] = useState("");
  // El reloj vive en estado para que "hace 4 min" no se congele mientras la
  // pantalla está abierta, que es todo el turno.
  const [ahora, setAhora] = useState(() => Date.now());

  const traer = useCallback(async () => {
    try {
      const r = await fetch("/api/consultorio/pacientes", { cache: "no-store" });
      const d = await r.json();
      if (d.ok) setPacientes(d.pacientes);
    } catch {
      // Si falla una vuelta, la siguiente la corrige. Interrumpir al doctor con
      // un error por un parpadeo de red sería peor.
    }
    setAhora(Date.now());
  }, []);

  useEffect(() => {
    const id = setInterval(traer, 5000);
    return () => clearInterval(id);
  }, [traer]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return pacientes;
    return pacientes.filter(
      (p) =>
        p.nombre.toLowerCase().includes(q) ||
        p.telefono.includes(q) ||
        p.motivo.toLowerCase().includes(q),
    );
  }, [pacientes, busca]);

  const hoy = pacientes.filter((p) => esDeHoy(p.creado)).length;

  return (
    <>
      <Encabezado
        titulo="Pacientes"
        detalle={
          pacientes.length === 0
            ? "Todavía no se ha registrado nadie"
            : `${pacientes.length} en total · ${hoy} ${hoy === 1 ? "registrado hoy" : "registrados hoy"}`
        }
      >
        {escritorio}
        <label className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--texto-3)]"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar paciente"
            className="campo campo-icono w-[230px]"
          />
        </label>
      </Encabezado>

      <div className="p-6">
        {pacientes.length === 0 ? (
          <div className="tarjeta px-8 py-14 text-center">
            <p className="font-serif text-[20px] text-[var(--texto)]">
              Nadie se ha registrado todavía
            </p>
            <p className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-relaxed text-[var(--texto-2)]">
              Pegá tu código{" "}
              <span className="font-mono font-semibold text-[var(--texto)]">{codigo}</span> en la
              sala de espera. En cuanto alguien lo escanee va a aparecer acá, sin que tengas que
              hacer nada.
            </p>
            <Link href="/consultorio/codigo" className="boton mt-5 inline-flex">
              Ver mi código
            </Link>
          </div>
        ) : (
          <div className="tarjeta overflow-hidden">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-[var(--linea)] bg-[var(--panel-2)] text-left text-[12px] font-semibold uppercase tracking-wide text-[var(--texto-3)]">
                  <th className="w-[340px] px-5 py-3">Paciente</th>
                  <th className="hidden px-3 py-3 md:table-cell">Motivo</th>
                  <th className="hidden w-[150px] px-3 py-3 sm:table-cell">Documentos</th>
                  <th className="w-[110px] px-3 py-3 text-right">Registrado</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => {
                  const a = edad(p.nacimiento);
                  const c = documentos[p.id];
                  const nuevo = ahora - Date.parse(p.creado) < 30 * MINUTO;
                  return (
                    <tr key={p.id} className="fila border-b border-[var(--linea)] last:border-0">
                      <td className="px-5 py-3">
                        <Link href={`/consultorio/paciente/${p.id}`} className="flex items-center gap-3">
                          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--panel-2)] font-serif text-[14px] text-[var(--texto-2)]">
                            {iniciales(p.nombre)}
                            {nuevo && (
                              <span
                                title="Llegó hace menos de media hora"
                                className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--verde)] ring-2 ring-white"
                              />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-serif text-[16px] leading-snug text-[var(--texto)]">
                                {p.nombre}
                              </span>
                              {p.alergias && (
                                <span
                                  title={`Alergias: ${p.alergias}`}
                                  className="chip chip-rojo shrink-0"
                                >
                                  alergias
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-[12.5px] text-[var(--texto-2)]">
                              {[a !== null ? `${a} años` : null, p.telefono]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="hidden px-3 py-3 md:table-cell">
                        <span className="block truncate text-[13.5px] text-[var(--texto-2)]">
                          {p.motivo || "—"}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 sm:table-cell">
                        {!c ? (
                          <span className="text-[13px] text-[var(--texto-3)]">sin nada aún</span>
                        ) : (
                          <span className="flex flex-wrap gap-1.5">
                            {c.recetas > 0 && (
                              <span className="chip chip-gris">
                                {c.recetas} {c.recetas === 1 ? "receta" : "recetas"}
                              </span>
                            )}
                            {c.ordenes > 0 && (
                              <span className="chip chip-verde">
                                {c.ordenes} {c.ordenes === 1 ? "orden" : "órdenes"}
                              </span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] text-[var(--texto-2)]">
                        {haceCuanto(p.creado, ahora)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={`/consultorio/paciente/${p.id}`}
                          aria-label={`Abrir ${p.nombre}`}
                          className="inline-flex text-[var(--texto-3)] transition hover:text-[var(--verde)]"
                        >
                          <ChevronRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-[14px] text-[var(--texto-2)]">
                      Nadie calza con “{busca}”.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
