"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, User, ShieldCheck, ArrowLeft, Bot } from "lucide-react";
import type { LoginResult } from "@/lib/auth";

// Login NEUTRO: una sola puerta para todos los clientes. No muestra marca de
// ningún cliente; al validar, la contraseña decide a qué dashboard (tenant)
// entra. Si el tenant tiene 2FA, se pide un segundo paso con el código de la app.
export function LoginPage({
  onLogin,
}: {
  // Async: la contraseña se valida contra el servidor. token = código del 2FA
  // (solo se manda en el segundo paso, cuando el servidor lo pide).
  onLogin: (email: string, password: string, token?: string) => Promise<LoginResult>;
}) {
  const [paso, setPaso] = useState<"credenciales" | "codigo">("credenciales");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [token, setToken] = useState("");
  // Si no es null, es la primera vez del usuario: mostramos el QR de enrolamiento.
  const [enrolar, setEnrolar] = useState<{ qr: string; secret: string } | null>(null);
  const [error, setError] = useState(false); // error de usuario/contraseña
  const [errorCodigo, setErrorCodigo] = useState(false); // código 2FA inválido
  const [enviando, setEnviando] = useState(false);

  async function enviarCredenciales(e: FormEvent) {
    e.preventDefault();
    setError(false);
    setEnviando(true);
    try {
      const r = await onLogin(email, password);
      if (r.tipo === "necesita2fa") {
        setToken("");
        setErrorCodigo(false);
        setEnrolar(r.enrolar ?? null);
        setPaso("codigo");
      } else if (r.tipo === "error") {
        setError(true);
      }
      // "ok" redirige solo (window.location.assign).
    } finally {
      setEnviando(false);
    }
  }

  async function enviarCodigo(e: FormEvent) {
    e.preventDefault();
    setErrorCodigo(false);
    setEnviando(true);
    try {
      const r = await onLogin(email, password, token);
      if (r.tipo === "necesita2fa") {
        if (r.enrolar) setEnrolar(r.enrolar); // sigue enrolando
        setErrorCodigo(true); // código incorrecto o vencido
      } else if (r.tipo === "error") {
        // La contraseña dejó de ser válida: volver al primer paso.
        setError(true);
        setPaso("credenciales");
      }
      // "ok" redirige solo.
    } finally {
      setEnviando(false);
    }
  }

  function volver() {
    setPaso("credenciales");
    setToken("");
    setErrorCodigo(false);
    setEnrolar(null);
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
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#22d3ee] via-[#8b5cf6] to-[#e879f9] text-white shadow-sm">
                <Bot size={28} strokeWidth={2.2} />
              </span>
            </div>
            <h1 className="mt-4 text-center text-[22px] font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-[#22d3ee] via-[#8b5cf6] to-[#e879f9] bg-clip-text text-transparent">
                MiAgentIA
              </span>
            </h1>
            <p className="mt-0.5 text-center text-[13px] font-semibold text-[#5b6b80]">
              Centro de Comunicación
            </p>
            <p className="mt-2 text-center text-[12.5px] text-[#94a3b4]">
              {paso === "codigo"
                ? enrolar
                  ? "Configura tu verificación en dos pasos"
                  : "Ingresa el código de tu app de autenticación"
                : "Ingresa con tu cuenta para continuar"}
            </p>

            {paso === "credenciales" ? (
              <form onSubmit={enviarCredenciales} className="mt-6 space-y-4">
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
            ) : (
              <>
              <form onSubmit={enviarCodigo} className="mt-6 space-y-4">
                {enrolar && (
                  <div className="rounded-xl border border-line bg-surface p-3 text-center">
                    <p className="mb-2 text-[12px] leading-snug text-[#5b6b80]">
                      Primera vez: escaneá este código con Google Authenticator o
                      Authy, y luego ingresá el código de 6 dígitos que te muestre.
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={enrolar.qr}
                      alt="Código QR para configurar la verificación en dos pasos"
                      width={180}
                      height={180}
                      className="mx-auto rounded-lg"
                    />
                    <p className="mt-2 text-[11px] text-[#94a3b4]">
                      ¿No podés escanear? Clave:{" "}
                      <span className="font-mono font-semibold text-[#5b6b80]">
                        {enrolar.secret}
                      </span>
                    </p>
                  </div>
                )}
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-[#0f1b2d]">
                    Código de verificación
                  </span>
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 focus-within:border-brand">
                    <ShieldCheck size={16} className="shrink-0 text-[#94a3b4]" />
                    <input
                      type="text"
                      value={token}
                      onChange={(e) => {
                        // Solo dígitos, máximo 6.
                        setToken(e.target.value.replace(/\D/g, "").slice(0, 6));
                        setErrorCodigo(false);
                      }}
                      placeholder="000000"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      maxLength={6}
                      required
                      className="w-full bg-transparent text-center text-lg font-bold tracking-[0.4em] text-[#0f1b2d] outline-none placeholder:tracking-[0.3em] placeholder:text-[#cbd5e1]"
                    />
                  </div>
                </label>

                {errorCodigo && (
                  <p className="rounded-lg bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-[#a32923]">
                    Código inválido o vencido. Revisa tu app e inténtalo de nuevo.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={enviando || token.length !== 6}
                  className="w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {enviando ? "Verificando..." : "Verificar y entrar"}
                </button>

              </form>
                <button
                  type="button"
                  onClick={volver}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 text-[12.5px] font-semibold text-[#5b6b80] transition hover:text-brand"
                >
                  <ArrowLeft size={14} /> Volver
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] font-medium text-[#94a3b4]">
          Plataforma omnicanal · WhatsApp, redes y chat interno
        </p>
      </div>
    </main>
  );
}
