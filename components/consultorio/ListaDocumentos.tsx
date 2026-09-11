"use client";

// Todo lo que el doctor ha dejado escrito, de un tipo, para todos sus
// pacientes. Sirve la misma tabla para recetas y para órdenes porque la
// pregunta es la misma ("qué le he dado a quién y cuándo"); lo único que cambia
// es la columna del medio.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { Encabezado } from "@/components/consultorio/Encabezado";
import { agrupar } from "@/lib/consultorio/examenes";
import type { Documento } from "@/lib/consultorio/tipos";

type ConNombre = Documento & { pacienteNombre: string };

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-SV", { day: "2-digit", month: "short", year: "numeric" });

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("es-SV", { hour: "numeric", minute: "2-digit" });

export function ListaDocumentos({
  tipo,
  titulo,
  vacio,
}: {
  tipo: "receta" | "orden";
  titulo: string;
  vacio: string;
}) {
  const [todos, setTodos] = useState<ConNombre[] | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch("/api/consultorio/documentos", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (vivo && d.ok) setTodos(d.documentos);
      })
      .catch(() => vivo && setTodos([]));
    return () => {
      vivo = false;
    };
  }, []);

  const lista = useMemo(() => {
    const suyos = (todos ?? []).filter((d) => d.tipo === tipo);
    const q = busca.trim().toLowerCase();
    if (!q) return suyos;
    return suyos.filter((d) => d.pacienteNombre.toLowerCase().includes(q));
  }, [todos, tipo, busca]);

  const sinEnviar = lista.filter((d) => !d.enviado || d.enviado.simulado).length;

  return (
    <>
      <Encabezado
        titulo={titulo}
        detalle={
          todos === null
            ? "Cargando"
            : lista.length === 0
              ? "Todavía no hay ninguna"
              : `${lista.length} en total${sinEnviar > 0 ? ` · ${sinEnviar} sin llegar al paciente` : ""}`
        }
      >
        <label className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--texto-3)]"
          />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por paciente"
            className="campo campo-icono w-[240px]"
          />
        </label>
      </Encabezado>

      <div className="p-6">
        {todos !== null && lista.length === 0 ? (
          <div className="tarjeta px-8 py-14 text-center">
            <p className="font-serif text-[20px] text-[var(--texto)]">{vacio}</p>
            <p className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-relaxed text-[var(--texto-2)]">
              Se crean desde el expediente de cada paciente.
            </p>
            <Link href="/consultorio" className="boton mt-5 inline-flex">
              Ver pacientes
            </Link>
          </div>
        ) : (
          <div className="tarjeta overflow-hidden">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-[var(--linea)] bg-[var(--panel-2)] text-left text-[12px] font-semibold uppercase tracking-wide text-[var(--texto-3)]">
                  <th className="w-[280px] px-5 py-3">Paciente</th>
                  <th className="px-3 py-3">{tipo === "receta" ? "Medicamentos" : "Exámenes"}</th>
                  <th className="hidden w-[120px] px-3 py-3 sm:table-cell">Correo</th>
                  <th className="w-[120px] px-3 py-3 text-right">Fecha</th>
                  <th className="w-12 px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {lista.map((d) => (
                  <tr key={d.id} className="fila border-b border-[var(--linea)] last:border-0">
                    <td className="px-5 py-3">
                      <Link
                        href={`/consultorio/paciente/${d.pacienteId}`}
                        className="font-serif text-[15.5px] text-[var(--texto)]"
                      >
                        {d.pacienteNombre}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {d.tipo === "receta" ? (
                        <span className="block truncate text-[13.5px] text-[var(--texto-2)]">
                          {d.medicamentos.map((m) => m.nombre).join(", ")}
                        </span>
                      ) : (
                        <span className="flex flex-wrap gap-1.5">
                          <span className="chip chip-verde">{d.examenes.length}</span>
                          <span className="truncate text-[13.5px] text-[var(--texto-2)]">
                            {agrupar(d.examenes)
                              .map((g) => g.area)
                              .join(", ")}
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-3 sm:table-cell">
                      {!d.enviado ? (
                        <span className="chip chip-gris">Sin enviar</span>
                      ) : d.enviado.simulado ? (
                        <span className="chip chip-ambar" title="Falta conectar el proveedor">
                          No salió
                        </span>
                      ) : (
                        <span className="chip chip-verde">Enviada</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-[13px] text-[var(--texto-2)]">
                      {fecha(d.fecha)}
                      <span className="block text-[12px] text-[var(--texto-3)]">
                        {hora(d.fecha)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/consultorio/paciente/${d.pacienteId}`}
                        aria-label={`Abrir el expediente de ${d.pacienteNombre}`}
                        className="inline-flex text-[var(--texto-3)] transition hover:text-[var(--verde)]"
                      >
                        <ChevronRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {todos === null && (
                  <tr>
                    <td colSpan={5} className="px-5 py-10 text-center text-[14px] text-[var(--texto-2)]">
                      Cargando
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
