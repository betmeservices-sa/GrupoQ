"use client";

// El expediente: lo que el doctor hace con el paciente que ya llegó.
//
// Dos documentos y nada más: la orden de exámenes y la receta. La orden va
// primero porque es la que más se usa y la que más tiempo cuesta escribir a
// mano; acá se marca y listo.
//
// La hoja de exámenes está en columnas por área y no en una lista alfabética
// porque así es como se indican: nadie busca "TSH" entre ciento veinte
// estudios ordenados por letra, la busca en hormonas. Y la barra de acciones va
// pegada abajo porque la hoja es larga: con el botón al final, marcar el último
// examen obliga a un viaje de vuelta.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import { Encabezado } from "@/components/consultorio/Encabezado";
import { AREAS, agrupar, preparacion } from "@/lib/consultorio/examenes";
import { edad, type Doctor, type Documento, type Medicamento, type Paciente } from "@/lib/consultorio/tipos";

type Pestana = "orden" | "receta";

const MED_VACIO: Medicamento = { nombre: "", dosis: "", frecuencia: "", duracion: "" };

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString("es-SV", { day: "numeric", month: "long", year: "numeric" });

export function Expediente({
  doctor,
  paciente,
  documentos: iniciales,
}: {
  doctor: Doctor;
  paciente: Paciente;
  documentos: Documento[];
}) {
  const [pestana, setPestana] = useState<Pestana>("orden");
  const [documentos, setDocumentos] = useState<Documento[]>(iniciales);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [diagnostico, setDiagnostico] = useState("");
  const [indicaciones, setIndicaciones] = useState("");
  const [medicamentos, setMedicamentos] = useState<Medicamento[]>([{ ...MED_VACIO }]);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; tono: "bien" | "mal" } | null>(null);

  const anios = edad(paciente.nacimiento);
  const avisos = useMemo(() => preparacion(marcados), [marcados]);

  function marcar(id: string) {
    setMarcados((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  function cambiarMed(i: number, campo: keyof Medicamento, valor: string) {
    setMedicamentos((ms) => ms.map((m, j) => (j === i ? { ...m, [campo]: valor } : m)));
  }

  async function guardar(enviar: boolean) {
    setGuardando(true);
    setAviso(null);
    try {
      const cuerpo =
        pestana === "orden"
          ? { tipo: "orden", pacienteId: paciente.id, examenes: marcados, diagnostico, indicaciones }
          : { tipo: "receta", pacienteId: paciente.id, medicamentos, indicaciones };

      const r = await fetch("/api/consultorio/documentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json();
      if (!d.ok) {
        setAviso({ texto: d.error ?? "No se pudo guardar.", tono: "mal" });
        setGuardando(false);
        return;
      }

      let doc: Documento = d.documento;
      let texto = pestana === "orden" ? "Orden guardada." : "Receta guardada.";

      if (enviar) {
        const e = await fetch(`/api/consultorio/documentos/${doc.id}/enviar`, { method: "POST" });
        const de = await e.json();
        if (!de.ok) {
          setAviso({ texto: `Se guardó, pero no se envió: ${de.error}`, tono: "mal" });
        } else {
          doc = {
            ...doc,
            enviado: { a: de.a, cuando: new Date().toISOString(), simulado: de.simulado },
          };
          texto = de.simulado
            ? `Guardada. El correo a ${de.a} NO salió: falta conectar el proveedor.`
            : `Guardada y enviada a ${de.a}.`;
        }
      }

      setDocumentos((prev) => [doc, ...prev]);
      setMarcados([]);
      setDiagnostico("");
      setIndicaciones("");
      setMedicamentos([{ ...MED_VACIO }]);
      setAviso((a) => a ?? { texto, tono: "bien" });
    } catch {
      setAviso({ texto: "No se pudo guardar: falló la conexión.", tono: "mal" });
    }
    setGuardando(false);
  }

  const puedeGuardar =
    pestana === "orden" ? marcados.length > 0 : medicamentos.some((m) => m.nombre.trim());

  return (
    <>
      <Encabezado
        titulo={paciente.nombre}
        detalle={[
          anios !== null ? `${anios} años` : null,
          paciente.sexo === "F" ? "femenino" : paciente.sexo === "M" ? "masculino" : null,
          paciente.telefono,
          paciente.correo || "sin correo",
        ]
          .filter(Boolean)
          .join("  ·  ")}
      >
        <Link href="/consultorio" className="boton-2 no-imprimir">
          <ArrowLeft size={15} /> Pacientes
        </Link>
      </Encabezado>

      <main className="px-6 py-6 pb-28">
        {(paciente.motivo || paciente.alergias) && (
          <div className="tarjeta mb-6 px-5 py-4">
            {paciente.motivo && (
              <p className="font-serif text-[16px] leading-relaxed text-[var(--texto)]">
                {paciente.motivo}
              </p>
            )}
            {paciente.alergias && (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-[14px] text-[var(--texto)]">
                <span className="chip chip-rojo">
                  <TriangleAlert size={12} /> Alergias
                </span>
                {paciente.alergias}
              </p>
            )}
          </div>
        )}

        <div className="no-imprimir flex gap-6 border-b border-[var(--linea-2)]">
          {(
            [
              ["orden", "Orden de exámenes"],
              ["receta", "Receta"],
            ] as const
          ).map(([id, texto]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPestana(id)}
              className={`-mb-px border-b-2 pb-2.5 font-serif text-[17px] transition ${
                pestana === id
                  ? "border-[var(--verde)] text-[var(--texto)]"
                  : "border-transparent text-[var(--texto-3)] hover:text-[var(--texto-2)]"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>

        {pestana === "orden" ? (
          <section className="tarjeta no-imprimir mt-5 px-6 py-5">
            {/* Columnas de verdad (CSS multicolumna): así la hoja se lee como el
                formulario del laboratorio y cabe más en una pantalla sin
                volverse una lista infinita. */}
            <div className="columns-1 gap-9 sm:columns-2 lg:columns-3">
              {AREAS.map((a) => {
                const n = a.examenes.filter((e) => marcados.includes(e.id)).length;
                return (
                  <div key={a.id} className="mb-7 break-inside-avoid">
                    <h3 className="flex items-baseline justify-between gap-2 border-b border-[var(--barra)] pb-1 font-serif text-[15.5px] text-[var(--texto)]">
                      {a.nombre}
                      {n > 0 && (
                        <span className="font-sans text-[12px] font-semibold text-[var(--verde)]">
                          {n}
                        </span>
                      )}
                    </h3>
                    <div className="mt-1.5">
                      {a.examenes.map((e) => (
                        <label key={e.id} className="casilla">
                          <input
                            type="checkbox"
                            checked={marcados.includes(e.id)}
                            onChange={() => marcar(e.id)}
                          />
                          <span className="text-[13.5px] leading-snug text-[var(--texto)]">
                            {e.nombre}
                            {e.nota && (
                              <span className="block text-[12px] text-[var(--texto-3)]">
                                {e.nota}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-1 grid gap-5 border-t border-[var(--linea)] pt-5 sm:grid-cols-2">
              <label className="block">
                <span className="block text-[13px] font-semibold text-[var(--texto-2)]">
                  Diagnóstico presuntivo
                </span>
                <input
                  value={diagnostico}
                  onChange={(e) => setDiagnostico(e.target.value)}
                  className="campo"
                />
              </label>
              <label className="block">
                <span className="block text-[13px] font-semibold text-[var(--texto-2)]">
                  Indicaciones para el laboratorio
                </span>
                <input
                  value={indicaciones}
                  onChange={(e) => setIndicaciones(e.target.value)}
                  className="campo"
                />
              </label>
            </div>
          </section>
        ) : (
          <section className="tarjeta no-imprimir mt-5 px-6 py-5">
            <div className="space-y-4">
              {medicamentos.map((m, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[minmax(0,2.2fr)_1fr_1fr_1fr]">
                  <input
                    placeholder="Medicamento"
                    value={m.nombre}
                    onChange={(e) => cambiarMed(i, "nombre", e.target.value)}
                    className="campo font-serif text-[15.5px]"
                  />
                  <input
                    placeholder="Dosis"
                    value={m.dosis}
                    onChange={(e) => cambiarMed(i, "dosis", e.target.value)}
                    className="campo"
                  />
                  <input
                    placeholder="Cada cuánto"
                    value={m.frecuencia}
                    onChange={(e) => cambiarMed(i, "frecuencia", e.target.value)}
                    className="campo"
                  />
                  <input
                    placeholder="Por cuánto tiempo"
                    value={m.duracion}
                    onChange={(e) => cambiarMed(i, "duracion", e.target.value)}
                    className="campo"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMedicamentos((ms) => [...ms, { ...MED_VACIO }])}
              className="mt-4 text-[13.5px] font-medium text-[var(--verde)] underline underline-offset-4"
            >
              Agregar otro medicamento
            </button>

            <label className="mt-6 block border-t border-[var(--linea)] pt-5">
              <span className="block text-[13px] font-semibold text-[var(--texto-2)]">
                Indicaciones
              </span>
              <textarea
                rows={3}
                value={indicaciones}
                onChange={(e) => setIndicaciones(e.target.value)}
                className="campo resize-y"
              />
            </label>
          </section>
        )}

        {aviso && (
          <p
            className={`no-imprimir mt-4 border-l-2 px-4 py-3 text-[14px] text-[var(--texto)] ${
              aviso.tono === "bien"
                ? "border-[var(--verde)] bg-[var(--verde-claro)]"
                : "border-[var(--alerta)] bg-[var(--alerta-clara)]"
            }`}
          >
            {aviso.texto}
          </p>
        )}

        {documentos.length > 0 && (
          <section className="mt-9">
            <h2 className="font-serif text-[20px] text-[var(--texto)]">
              Lo que ya le dejaste escrito
            </h2>
            <div className="mt-4 space-y-5">
              {documentos.map((d) => (
                <article key={d.id} className="documento px-6 py-5">
                  <header className="membrete flex flex-wrap items-start justify-between gap-3 pb-3">
                    <span>
                      <span className="block font-serif text-[19px] text-[var(--texto)]">
                        {doctor.nombre}
                      </span>
                      <span className="block font-sans text-[12.5px] text-[var(--texto-2)]">
                        {doctor.especialidad} · {doctor.registro} · {doctor.telefono}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-serif text-[15px] text-[var(--texto)]">
                        {d.tipo === "receta" ? "Receta" : "Orden de laboratorio"}
                      </span>
                      <span className="block font-sans text-[12.5px] text-[var(--texto-2)]">
                        {fechaLarga(d.fecha)}
                      </span>
                    </span>
                  </header>

                  <p className="mt-3 text-[13.5px] text-[var(--texto-2)]">
                    Para{" "}
                    <span className="font-serif text-[15px] text-[var(--texto)]">
                      {paciente.nombre}
                    </span>
                    {anios !== null ? `, ${anios} años` : ""}
                  </p>

                  {d.tipo === "receta" ? (
                    <ol className="mt-4 space-y-2.5">
                      {d.medicamentos.map((m, i) => (
                        <li key={i} className="flex gap-3">
                          <span className="font-serif text-[15px] text-[var(--texto-3)]">
                            {i + 1}.
                          </span>
                          <span>
                            <span className="block font-serif text-[16px] leading-snug text-[var(--texto)]">
                              {m.nombre}
                            </span>
                            {[m.dosis, m.frecuencia, m.duracion].filter(Boolean).length > 0 && (
                              <span className="block text-[13.5px] text-[var(--texto-2)]">
                                {[m.dosis, m.frecuencia, m.duracion].filter(Boolean).join(" · ")}
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      {agrupar(d.examenes).map((g) => (
                        <div key={g.area}>
                          <p className="border-b border-[var(--linea)] pb-1 font-serif text-[14.5px] text-[var(--texto)]">
                            {g.area}
                          </p>
                          <ul className="mt-1 space-y-0.5">
                            {g.examenes.map((e) => (
                              <li key={e.id} className="text-[13.5px] text-[var(--texto-2)]">
                                {e.nombre}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  {d.tipo === "orden" && d.diagnostico && (
                    <p className="mt-4 text-[13.5px] text-[var(--texto)]">
                      <span className="text-[var(--texto-2)]">Diagnóstico presuntivo:</span>{" "}
                      {d.diagnostico}
                    </p>
                  )}
                  {d.tipo === "orden" && preparacion(d.examenes).length > 0 && (
                    <p className="mt-1 text-[13.5px] text-[var(--texto)]">
                      <span className="text-[var(--texto-2)]">Preparación:</span>{" "}
                      {preparacion(d.examenes).join(", ")}
                    </p>
                  )}
                  {d.indicaciones && (
                    <p className="mt-3 text-[14px] leading-relaxed text-[var(--texto)]">
                      {d.indicaciones}
                    </p>
                  )}

                  {/* La línea de firma: la documento se imprime y alguien la firma. */}
                  <div className="mt-8 ml-auto w-[230px] border-t border-[var(--barra)] pt-1 text-center">
                    <p className="font-serif text-[13.5px] text-[var(--texto)]">{doctor.nombre}</p>
                    <p className="text-[12px] text-[var(--texto-2)]">{doctor.registro}</p>
                  </div>

                  <footer className="no-imprimir mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--linea)] pt-3">
                    <span className="text-[12.5px] text-[var(--texto-2)]">
                      {!d.enviado ? (
                        "Sin enviar"
                      ) : d.enviado.simulado ? (
                        <span className="text-[var(--ambar)]">
                          No salió: falta conectar el correo ({d.enviado.a})
                        </span>
                      ) : (
                        `Enviada a ${d.enviado.a}`
                      )}
                    </span>
                    <button type="button" onClick={() => window.print()} className="boton-2">
                      Imprimir
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Pegada abajo: la hoja de exámenes es larga y el resumen tiene que estar
          a la vista mientras se marca, no al final del recorrido. */}
      <div className="no-imprimir fixed inset-x-0 bottom-0 border-t border-[var(--linea-2)] bg-[var(--panel)]/95 backdrop-blur lg:left-[236px]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
          <p className="text-[13.5px] text-[var(--texto-2)]">
            {pestana === "orden" ? (
              marcados.length === 0 ? (
                "Marcá los exámenes que le vas a dejar."
              ) : (
                <>
                  <span className="font-semibold text-[var(--texto)]">
                    {marcados.length} {marcados.length === 1 ? "examen" : "exámenes"}
                  </span>
                  {avisos.length > 0 && <> · Preparación: {avisos.join(", ")}</>}
                </>
              )
            ) : puedeGuardar ? (
              <span className="font-semibold text-[var(--texto)]">
                {medicamentos.filter((m) => m.nombre.trim()).length}{" "}
                {medicamentos.filter((m) => m.nombre.trim()).length === 1
                  ? "medicamento"
                  : "medicamentos"}
              </span>
            ) : (
              "Escribí al menos un medicamento."
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => guardar(false)}
              disabled={!puedeGuardar || guardando}
              className="boton-2"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => guardar(true)}
              disabled={!puedeGuardar || guardando || !paciente.correo}
              title={paciente.correo ? undefined : "Este paciente no dejó correo al registrarse"}
              className="boton"
            >
              {guardando ? "Guardando" : "Guardar y enviar"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
