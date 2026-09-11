"use client";

// Mi código: la tarjeta que se imprime y se pega en la sala de espera.
//
// Vive en su propia sección y no en el centro del panel porque se usa una vez
// (se imprime, se pega) y después estorba: lo que el doctor mira todo el día
// son sus pacientes.

import { useEffect, useState } from "react";
import { Copy, Download, Share2 } from "lucide-react";
import { Encabezado } from "@/components/consultorio/Encabezado";
import type { Doctor } from "@/lib/consultorio/tipos";

export function Codigo({ doctor }: { doctor: Doctor }) {
  const [enlace, setEnlace] = useState("");
  const [copiado, setCopiado] = useState(false);

  // El enlace se arma en el navegador: así sale con el host real, sea
  // localhost, la IP de la red o el dominio, sin configurar nada.
  useEffect(() => {
    setEnlace(`${window.location.origin}/r/${doctor.codigo}`);
  }, [doctor.codigo]);

  async function copiar() {
    await navigator.clipboard.writeText(enlace);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  async function compartir() {
    if (navigator.share) {
      await navigator.share({ title: doctor.nombre, url: enlace }).catch(() => undefined);
    } else {
      await copiar();
    }
  }

  return (
    <>
      <Encabezado
        titulo="Mi código"
        detalle="Quien lo escanee se registra con vos, sin que tengas que hacer nada"
      >
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={compartir} className="boton">
            <Share2 size={15} /> Compartir
          </button>
          <button type="button" onClick={copiar} className="boton-2">
            <Copy size={15} /> {copiado ? "Copiado" : "Copiar enlace"}
          </button>
          <a
            href={`/api/consultorio/publico/qr/${doctor.codigo}`}
            download={`qr-${doctor.codigo}.png`}
            className="boton-2"
          >
            <Download size={15} /> Descargar
          </a>
          <button type="button" onClick={() => window.print()} className="boton-2">
            Imprimir
          </button>
        </div>
      </Encabezado>

      <div className="grid gap-6 p-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Esto es lo que se imprime: por eso se ve como se va a ver pegado en
            la pared, y no como un control de la interfaz. */}
        <div className="documento px-7 py-8 text-center">
          <p className="font-serif text-[15px] text-[var(--texto-2)]">{doctor.nombre}</p>
          <h2 className="mt-3 font-serif text-[24px] leading-snug text-[var(--texto)]">
            Escaneá para registrarte
          </h2>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/consultorio/publico/qr/${doctor.codigo}`}
            alt={`Código QR de ${doctor.nombre}`}
            width={300}
            height={300}
            className="mx-auto mt-4 w-full max-w-[300px]"
          />
          <p className="mt-2 font-mono text-[20px] font-semibold tracking-[0.35em] text-[var(--texto)]">
            {doctor.codigo}
          </p>
          <p className="mt-4 border-t border-[var(--linea)] pt-3 text-[12.5px] leading-relaxed text-[var(--texto-3)]">
            Tus datos quedan solo con {doctor.nombre.replace(/^Dra?\.\s*/, "")}.
          </p>
        </div>

        <div className="no-imprimir space-y-4">
          <div className="tarjeta px-5 py-4">
            <h3 className="font-serif text-[16px] text-[var(--texto)]">El enlace</h3>
            <p className="mt-1 break-all font-mono text-[13px] text-[var(--texto-2)]">
              {enlace || "…"}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--texto-2)]">
              Sirve igual que el QR: mandalo por WhatsApp a quien no esté en la sala.
            </p>
          </div>

          <div className="tarjeta px-5 py-4">
            <h3 className="font-serif text-[16px] text-[var(--texto)]">Cómo usarlo</h3>
            <ol className="mt-2 space-y-2 text-[13.5px] leading-relaxed text-[var(--texto-2)]">
              <li>
                <span className="font-semibold text-[var(--texto)]">Imprimí esta hoja</span> y pegala
                donde la gente espera.
              </li>
              <li>
                El paciente escanea con la cámara del teléfono y llena sus datos en menos de un
                minuto.
              </li>
              <li>
                Aparece solo en <span className="font-semibold text-[var(--texto)]">Pacientes</span>,
                y desde ahí le hacés la receta y la orden.
              </li>
            </ol>
          </div>
        </div>
      </div>
    </>
  );
}
