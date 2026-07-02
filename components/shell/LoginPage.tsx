"use client";

import { useState, type FormEvent } from "react";
import { Lock, Mail } from "lucide-react";
import { Brand } from "./Brand";

export function LoginPage({
  onLogin,
}: {
  onLogin: (email: string, password: string) => boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ok = onLogin(email, password);
    if (!ok) setError(true);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-sm">
          {/* Franja de marca: azul + rojo de Grupo Q */}
          <div className="flex h-1.5">
            <span className="flex-1 bg-[#006cb7]" />
            <span className="w-1/4 bg-[#a32923]" />
          </div>

          <div className="px-7 pb-7 pt-8">
            <div className="flex justify-center">
              <Brand />
            </div>
            <h1 className="mt-5 text-center text-[19px] font-extrabold tracking-tight text-[#006cb7]">
              Centro de Comunicación
            </h1>
            <p className="mt-1 text-center text-[13px] text-[#5b6b80]">
              Ingresa con tu cuenta para continuar
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-[#0f1b2d]">
                  Correo
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 focus-within:border-[#006cb7]">
                  <Mail size={16} className="shrink-0 text-[#94a3b4]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(false);
                    }}
                    placeholder="nombre@grupoq.com"
                    autoComplete="email"
                    required
                    className="w-full bg-transparent text-sm text-[#0f1b2d] outline-none placeholder:text-[#94a3b4]"
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[12.5px] font-semibold text-[#0f1b2d]">
                  Contraseña
                </span>
                <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 focus-within:border-[#006cb7]">
                  <Lock size={16} className="shrink-0 text-[#94a3b4]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(false);
                    }}
                    placeholder="••••••"
                    autoComplete="current-password"
                    required
                    className="w-full bg-transparent text-sm text-[#0f1b2d] outline-none placeholder:text-[#94a3b4]"
                  />
                </div>
              </label>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-[#a32923]">
                  Correo o contraseña incorrectos.
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-xl bg-[#006cb7] py-2.5 text-sm font-bold text-white shadow-sm shadow-[#006cb7]/25 transition hover:bg-[#0056b3]"
              >
                Iniciar sesión
              </button>
            </form>
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] font-medium text-[#94a3b4]">
          Grupo Q · Servirte con pasión es la fuerza que nos mueve
        </p>
      </div>
    </main>
  );
}
