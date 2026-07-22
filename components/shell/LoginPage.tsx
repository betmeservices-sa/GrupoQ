"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, User, MessagesSquare } from "lucide-react";

// Login NEUTRO: una sola puerta para todos los clientes. No muestra marca de
// ningún cliente; al validar, el correo decide a qué dashboard (tenant) entra.
export function LoginPage({
  onLogin,
}: {
  // Ahora es async: la contraseña se valida contra el servidor, no en el navegador.
  onLogin: (email: string, password: string) => Promise<boolean>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [error, setError] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(false);
    setEnviando(true);
    try {
      const ok = await onLogin(email, password);
      if (!ok) setError(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          {/* Franja de marca neutra */}
          <div className="flex h-1.5">
            <span className="flex-1 bg-brand" />
            <span className="w-1/4 bg-accent" />
          </div>

          <div className="px-7 pb-7 pt-8">
            <div className="flex flex-col items-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
                <MessagesSquare size={24} strokeWidth={2.2} />
              </span>
            </div>
            <h1 className="mt-5 text-center text-[19px] font-extrabold tracking-tight text-brand">
              Centro de Comunicación
            </h1>
            <p className="mt-1 text-center text-[13px] text-[#5b6b80]">
              Ingresa con tu cuenta para continuar
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-[#0f1b2d]">
                  Usuario
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 focus-within:border-brand">
                  <User size={16} className="shrink-0 text-[#94a3b4]" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(false);
                    }}
                    placeholder="usuario"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    className="w-full bg-transparent text-sm text-[#0f1b2d] outline-none placeholder:text-[#94a3b4]"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-[#0f1b2d]">
                  Contraseña
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 focus-within:border-brand">
                  <Lock size={16} className="shrink-0 text-[#94a3b4]" />
                  <input
                    type={verPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(false);
                    }}
                    placeholder="••••••"
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    className="w-full bg-transparent text-sm text-[#0f1b2d] outline-none placeholder:text-[#94a3b4]"
                  />
                  <button
                    type="button"
                    onClick={() => setVerPass((v) => !v)}
                    aria-label={verPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="shrink-0 text-[#94a3b4] transition hover:text-[#5b6b80]"
                  >
                    {verPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-[#a32923]">
                  Correo o contraseña incorrectos.
                </p>
              )}

              <button
                type="submit"
                disabled={enviando}
                className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
              >
                {enviando ? "Entrando..." : "Iniciar sesión"}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] font-medium text-[#94a3b4]">
          Plataforma omnicanal · WhatsApp, redes y chat interno
        </p>
      </div>
    </main>
  );
}
