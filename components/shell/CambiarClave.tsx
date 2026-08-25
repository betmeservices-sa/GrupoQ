"use client";

// Cambiar la propia contraseña.
//
// Existe porque la clave con la que se entrega una cuenta no puede quedarse
// para siempre: la sabemos nosotros, viajó por chat, y Verónica y Olga arrancan
// con la misma. Mientras siga siendo esa, la cuenta no es de ellas.
//
// Por eso, hasta que la cambien, el aviso queda visible en la barra. No se
// puede cerrar: taparlo es exactamente cómo una contraseña provisional se
// queda dos años.

import { useCallback, useEffect, useState } from "react";
import { KeyRound, X } from "lucide-react";

type Estado = { tipo: "ok" | "error"; texto: string } | null;

export function CambiarClave() {
  const [usuario, setUsuario] = useState<string | null>(null);
  const [propia, setPropia] = useState(true);
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [estado, setEstado] = useState<Estado>(null);
  const [enviando, setEnviando] = useState(false);

  const consultar = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/password");
      if (!r.ok) return;
      const d = (await r.json()) as { usuario?: string; propia?: boolean };
      // Sin usuario es un login de demo: no hay contraseña personal que cambiar.
      setUsuario(d.usuario ?? null);
      setPropia(Boolean(d.propia));
    } catch {
      // Sin respuesta no se muestra nada: mejor callado que un aviso que
      // aparece y desaparece.
    }
  }, []);

  useEffect(() => {
    void consultar();
  }, [consultar]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (nueva !== repetir) {
      setEstado({ tipo: "error", texto: "Las dos contraseñas nuevas no son iguales." });
      return;
    }
    setEnviando(true);
    setEstado(null);
    try {
      const r = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actual, nueva }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (!d.ok) {
        setEstado({ tipo: "error", texto: d.error ?? "No se pudo cambiar." });
        return;
      }
      setEstado({ tipo: "ok", texto: "Listo. La próxima vez entrá con la nueva." });
      setActual("");
      setNueva("");
      setRepetir("");
      setPropia(true);
      setTimeout(() => setAbierto(false), 1800);
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) return null;

  const campo =
    "w-full rounded-lg border border-line bg-card px-3 py-2 text-[13px] outline-none focus-visible:border-brand";

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={
          propia
            ? "flex w-full items-center gap-2 rounded-xl border border-line bg-surface/60 px-3 py-2.5 text-left text-[12.5px] font-semibold text-[var(--text-2)]"
            : "flex w-full items-center gap-2 rounded-xl border border-[var(--warn-line,#fcd34d)] bg-[var(--warn-bg,#fffbeb)] px-3 py-2.5 text-left text-[12.5px] font-semibold text-[var(--warn-fg,#92400e)]"
        }
      >
        <KeyRound size={14} className="shrink-0" />
        <span className="min-w-0 flex-1">
          {propia ? "Cambiar contraseña" : "Poné tu propia contraseña"}
        </span>
      </button>
    );
  }

  return (
    <form onSubmit={enviar} className="space-y-2 rounded-xl border border-line bg-surface/60 p-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
          <KeyRound size={13} />
          Tu contraseña
        </p>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar"
          className="text-[var(--text-3)]"
        >
          <X size={14} />
        </button>
      </div>

      {!propia && (
        <p className="text-[12px] leading-relaxed text-[var(--text-3)]">
          La que usás ahora te la dimos nosotros. Poné una que solo sepas vos.
        </p>
      )}

      <input
        type="password"
        value={actual}
        onChange={(e) => setActual(e.target.value)}
        placeholder="Contraseña actual"
        autoComplete="current-password"
        className={campo}
        required
      />
      <input
        type="password"
        value={nueva}
        onChange={(e) => setNueva(e.target.value)}
        placeholder="Nueva (mínimo 8 caracteres)"
        autoComplete="new-password"
        minLength={8}
        className={campo}
        required
      />
      <input
        type="password"
        value={repetir}
        onChange={(e) => setRepetir(e.target.value)}
        placeholder="Repetí la nueva"
        autoComplete="new-password"
        minLength={8}
        className={campo}
        required
      />

      <button
        type="submit"
        disabled={enviando}
        className="w-full rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60"
      >
        {enviando ? "Guardando" : "Guardar"}
      </button>

      {estado && (
        <p
          className={
            estado.tipo === "ok"
              ? "text-[12px] text-[#2f9e2f]"
              : "text-[12px] text-[var(--bad-fg,#991b1b)]"
          }
        >
          {estado.texto}
        </p>
      )}
    </form>
  );
}
