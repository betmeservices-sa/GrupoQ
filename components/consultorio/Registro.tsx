"use client";

// El formulario que llena el paciente en su teléfono, en la sala de espera.
//
// Un campo por línea y objetivos grandes: se llena de pie, con una mano, a
// veces con la vista cansada. El teclado del teléfono cambia según el campo
// (type e inputMode) para que nadie tenga que buscar la arroba o el guion, y
// los campos van a 16 px porque abajo de eso iOS hace zoom al enfocar y
// descoloca la pantalla.
//
// Solo el nombre y el teléfono son obligatorios. Todo lo demás lo puede
// completar el doctor después: un formulario que no deja pasar sin la fecha de
// nacimiento exacta es un formulario que la gente abandona.

import { useState } from "react";

const CAMPOS_VACIOS = {
  nombre: "",
  telefono: "",
  correo: "",
  nacimiento: "",
  sexo: "",
  motivo: "",
  alergias: "",
};

export function Registro({ codigo }: { codigo: string }) {
  const [datos, setDatos] = useState(CAMPOS_VACIOS);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  function cambiar(campo: keyof typeof CAMPOS_VACIOS, valor: string) {
    setDatos((d) => ({ ...d, [campo]: valor }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const r = await fetch("/api/consultorio/publico/registro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...datos, codigo }),
      });
      const d = await r.json();
      if (!d.ok) {
        setError(d.error ?? "No se pudo registrar.");
        setEnviando(false);
        return;
      }
      setListo(true);
    } catch {
      setError("No se pudo registrar: revisá tu conexión.");
      setEnviando(false);
    }
  }

  if (listo) {
    return (
      <div className="mt-7 text-center">
        <p className="font-serif text-[24px] leading-snug text-[var(--texto)]">
          Listo, quedaste registrado
        </p>
        <p className="mx-auto mt-2 max-w-[34ch] text-[15px] leading-relaxed text-[var(--texto-2)]">
          Ya aparecés en la lista del doctor. Podés cerrar esta página y esperar a que te llamen.
        </p>
        <p className="mt-6 border-t border-[var(--linea)] pt-4 text-[13px] text-[var(--texto-3)]">
          Si te equivocaste en algo, avisale a la persona de recepción.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-5">
      <Campo etiqueta="Nombre completo" requerido>
        <input
          required
          autoComplete="name"
          value={datos.nombre}
          onChange={(e) => cambiar("nombre", e.target.value)}
          className="campo"
        />
      </Campo>

      <Campo etiqueta="Teléfono" requerido>
        <input
          required
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="7777 7777"
          value={datos.telefono}
          onChange={(e) => cambiar("telefono", e.target.value)}
          className="campo"
        />
      </Campo>

      <Campo etiqueta="Correo" ayuda="Ahí te llegan la receta y los exámenes">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={datos.correo}
          onChange={(e) => cambiar("correo", e.target.value)}
          className="campo"
        />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Nacimiento">
          <input
            type="date"
            value={datos.nacimiento}
            onChange={(e) => cambiar("nacimiento", e.target.value)}
            className="campo"
          />
        </Campo>
        <Campo etiqueta="Sexo">
          <select
            value={datos.sexo}
            onChange={(e) => cambiar("sexo", e.target.value)}
            className="campo"
          >
            <option value="">Sin decir</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
            <option value="otro">Otro</option>
          </select>
        </Campo>
      </div>

      <Campo etiqueta="¿Por qué venís a consulta?">
        <textarea
          rows={3}
          value={datos.motivo}
          onChange={(e) => cambiar("motivo", e.target.value)}
          className="campo resize-y"
        />
      </Campo>

      <Campo etiqueta="Alergias a medicamentos" ayuda="Si no tenés, dejalo vacío">
        <input
          value={datos.alergias}
          onChange={(e) => cambiar("alergias", e.target.value)}
          className="campo"
        />
      </Campo>

      {error && (
        <p className="border-l-2 border-[var(--alerta)] bg-[var(--alerta-clara)] px-3 py-2.5 text-[14px] text-[var(--texto)]">
          {error}
        </p>
      )}

      <button type="submit" disabled={enviando} className="boton w-full py-3.5 text-[15.5px]">
        {enviando ? "Registrando" : "Registrarme"}
      </button>
    </form>
  );
}

function Campo({
  etiqueta,
  ayuda,
  requerido,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-serif text-[15.5px] text-[var(--texto)]">
        {etiqueta}
        {!requerido && <span className="font-sans text-[13px] text-[var(--texto-3)]"> opcional</span>}
      </span>
      {ayuda && <span className="block text-[13px] text-[var(--texto-2)]">{ayuda}</span>}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
