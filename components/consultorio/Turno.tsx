"use client";

// El turno, ya tomado: en qué número va la persona y cuántos tiene delante.
//
// Esta pantalla se mira de lejos y de reojo, con el teléfono en la mano,
// mientras se espera sentado. Por eso el número es enorme y lo demás es
// pequeño: la única pregunta que contesta es "¿ya me toca?".
//
// Se refresca sola cada cinco segundos. Un botón de actualizar en una sala de
// espera es pedirle a la gente que trabaje para saber su lugar.

import { useEffect, useState } from "react";
import { agrupar } from "@/lib/consultorio/examenes";

interface Estado {
  numero: number;
  /** El código de su orden: es lo que le piden en el mostrador. */
  codigo: string;
  estado: "esperando" | "atendiendo" | "pendiente" | "atendido";
  delante: number;
  /** Los exámenes que quedaron sin hacerse. */
  faltan: number;
  sucursal: string;
  factura: string | null;
  monto: number | null;
}

export function Turno({ turnoId, examenes }: { turnoId: string; examenes: string[] }) {
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    let vivo = true;
    const traer = async () => {
      try {
        const r = await fetch(`/api/consultorio/publico/turnos/${turnoId}`, { cache: "no-store" });
        const d = await r.json();
        if (vivo && d.ok) setEstado(d);
      } catch {
        // Un parpadeo de red no tiene por qué borrarle el turno a nadie de la
        // pantalla: se queda lo último que se supo y la siguiente vuelta corrige.
      }
    };
    void traer();
    const id = setInterval(traer, 5000);
    return () => {
      vivo = false;
      clearInterval(id);
    };
  }, [turnoId]);

  const faltan = estado?.faltan ?? 0;
  const llamando = estado?.estado === "atendiendo";
  // Un turno que la recepción dejó abierto pero sin nada pendiente ya terminó,
  // aunque en la consola le hayan dado continuar.
  const atendido = estado?.estado === "atendido" || (estado?.estado === "pendiente" && faltan === 0);
  const pendiente = estado?.estado === "pendiente" && faltan > 0;

  return (
    <div className="space-y-5">
      <section
        className={`tarjeta px-6 py-8 text-center ${
          llamando ? "border-[var(--verde)] ring-2 ring-[var(--verde)]" : ""
        }`}
      >
        <p className="text-[14px] text-[var(--texto-2)]">Tu turno</p>
        <p className="mt-1 font-serif text-[76px] leading-none text-[var(--texto)]">
          {estado ? estado.numero : "—"}
        </p>
        {estado?.codigo && (
          <p className="mt-2 font-mono text-[15px] tracking-[0.12em] text-[var(--texto-2)]">
            {estado.codigo}
          </p>
        )}

        {atendido ? (
          <div className="mt-5 border-t border-[var(--linea)] pt-5">
            <p className="font-serif text-[20px] text-[var(--texto)]">Ya te atendieron</p>
            {estado?.factura && (
              <p className="mt-2 font-mono text-[14px] text-[var(--texto-2)]">
                Factura {estado.factura}
                {estado.monto !== null && ` · ${estado.monto.toFixed(2)}`}
              </p>
            )}
          </div>
        ) : pendiente ? (
          <div className="mt-5 border-t border-[var(--linea)] pt-5">
            <p className="font-serif text-[22px] leading-snug text-[var(--texto)]">
              {faltan === 1 ? "Te falta 1 examen" : `Te faltan ${faltan} exámenes`}
            </p>
            <p className="mt-1.5 text-[13.5px] text-[var(--texto-2)]">
              Pasá al mostrador cuando puedas hacértelos.
            </p>
          </div>
        ) : llamando ? (
          <p className="mt-5 border-t border-[var(--linea)] pt-5 font-serif text-[24px] leading-snug text-[var(--verde-hondo)]">
            Te toca ahora, pasá al mostrador
          </p>
        ) : (
          <div className="mt-5 border-t border-[var(--linea)] pt-5">
            <p className="font-serif text-[24px] leading-snug text-[var(--texto)]">
              {estado === null
                ? "Buscando tu lugar"
                : estado.delante === 0
                  ? "Sos el siguiente"
                  : estado.delante === 1
                    ? "Hay 1 persona delante"
                    : `Hay ${estado.delante} personas delante`}
            </p>
            <p className="mt-1.5 text-[13.5px] text-[var(--texto-2)]">
              Esta pantalla se actualiza sola. No hace falta que la recargués.
            </p>
          </div>
        )}
      </section>

      {examenes.length > 0 && (
        <section className="tarjeta px-5 py-4">
          <h2 className="font-serif text-[16px] text-[var(--texto)]">Lo que vas a hacerte</h2>
          <div className="mt-2 space-y-2.5">
            {agrupar(examenes).map((g) => (
              <div key={g.area}>
                <p className="text-[12.5px] font-semibold text-[var(--texto-3)]">{g.area}</p>
                <p className="text-[13.5px] leading-relaxed text-[var(--texto-2)]">
                  {g.examenes.map((e) => e.nombre).join(", ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="px-1 text-center text-[13px] leading-relaxed text-[var(--texto-3)]">
        Podés guardar esta página. Si la cerrás, tu turno sigue siendo el{" "}
        {estado ? estado.numero : "que te tocó"}.
      </p>
    </div>
  );
}
