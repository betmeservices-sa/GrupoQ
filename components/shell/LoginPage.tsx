"use client";

import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, User, ShieldCheck, ArrowLeft } from "lucide-react";
import type { LoginResult } from "@/lib/auth";

// Login NEUTRO (front-door del demo) con la marca MiAgentIA: fondo negro y
// gradiente cian-violeta-magenta, igual que miagentia.com. Los dashboards por
// tenant conservan su tema claro; esto es solo la puerta de entrada.
export function LoginPage({
  onLogin,
}: {
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

  const inputWrap =
    "flex items-center gap-2 rounded-xl border border-white/10 bg-[#12121c] px-3.5 py-3 transition focus-within:border-[#8b5cf6] focus-within:bg-[#16161f] focus-within:shadow-[0_0_0_4px_rgba(139,92,246,0.12)]";
  const inputBase =
    "w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05050A] px-4">
      {/* Glows de marca */}
      <div className="pointer-events-none absolute -top-32 left-1/3 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.28),transparent_60%)] blur-2xl" />
      <div className="pointer-events-none absolute -bottom-32 right-1/4 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.20),transparent_62%)] blur-2xl" />

      <div className="relative w-full max-w-sm">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d18] shadow-2xl shadow-black/60">
          {/* Franja de gradiente de marca */}
          <div className="h-1 bg-gradient-to-r from-[#22d3ee] via-[#8b5cf6] to-[#e879f9]" />

          <div className="px-7 pb-8 pt-8">
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/miagentia-lockup.png" alt="MiAgentIA" className="h-11 w-auto" />
            </div>
            <p className="mt-5 text-center text-[13px] font-semibold text-white/90">
              Centro de Comunicación
            </p>
            <p className="mt-1 text-center text-[12.5px] text-white/40">
              {paso === "codigo"
                ? enrolar
                  ? "Configura tu verificación en dos pasos"
                  : "Ingresa el código de tu app de autenticación"
                : "Ingresa con tu cuenta para continuar"}
            </p>

            {paso === "credenciales" ? (
              <form onSubmit={enviarCredenciales} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-white/80">
                    Usuario
                  </span>
                  <div className={inputWrap}>
                    <User size={16} className="shrink-0 text-white/40" />
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
                      className={inputBase}
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-white/80">
                    Contraseña
                  </span>
                  <div className={inputWrap}>
                    <Lock size={16} className="shrink-0 text-white/40" />
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
                      className={inputBase}
                    />
                    <button
                      type="button"
                      onClick={() => setVerPass((v) => !v)}
                      aria-label={verPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="shrink-0 text-white/40 transition hover:text-white/70"
                    >
                      {verPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                {error && (
                  <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12.5px] font-semibold text-red-300">
                    Correo o contraseña incorrectos.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full rounded-xl bg-gradient-to-r from-[#22d3ee] via-[#8b5cf6] to-[#e879f9] py-2.5 text-sm font-bold text-white shadow-lg shadow-[#8b5cf6]/25 transition hover:opacity-90 disabled:opacity-50"
                >
                  {enviando ? "Entrando..." : "Iniciar sesión"}
                </button>
              </form>
            ) : (
              <>
                <form onSubmit={enviarCodigo} className="mt-6 space-y-4">
                  {enrolar && (
                    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
                      <p className="mb-2 text-[12px] leading-snug text-white/60">
                        Primera vez: escaneá este código con Google Authenticator o
                        Authy, y luego ingresá el código de 6 dígitos que te muestre.
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={enrolar.qr}
                        alt="Código QR para configurar la verificación en dos pasos"
                        width={180}
                        height={180}
                        className="mx-auto rounded-lg bg-white p-1"
                      />
                      <p className="mt-2 text-[11px] text-white/40">
                        ¿No podés escanear? Clave:{" "}
                        <span className="font-mono font-semibold text-white/70">
                          {enrolar.secret}
                        </span>
                      </p>
                    </div>
                  )}
                  <label className="block">
                    <span className="mb-1.5 block text-[12.5px] font-semibold text-white/80">
                      Código de verificación
                    </span>
                    <div className={inputWrap}>
                      <ShieldCheck size={16} className="shrink-0 text-white/40" />
                      <input
                        type="text"
                        value={token}
                        onChange={(e) => {
                          setToken(e.target.value.replace(/\D/g, "").slice(0, 6));
                          setErrorCodigo(false);
                        }}
                        placeholder="000000"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        autoFocus
                        maxLength={6}
                        required
                        className="w-full bg-transparent text-center text-lg font-bold tracking-[0.4em] text-white outline-none placeholder:tracking-[0.3em] placeholder:text-white/25"
                      />
                    </div>
                  </label>

                  {errorCodigo && (
                    <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12.5px] font-semibold text-red-300">
                      Código inválido o vencido. Revisa tu app e inténtalo de nuevo.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={enviando || token.length !== 6}
                    className="w-full rounded-xl bg-gradient-to-r from-[#22d3ee] via-[#8b5cf6] to-[#e879f9] py-2.5 text-sm font-bold text-white shadow-lg shadow-[#8b5cf6]/25 transition hover:opacity-90 disabled:opacity-50"
                  >
                    {enviando ? "Verificando..." : "Verificar y entrar"}
                  </button>
                </form>
                <button
                  type="button"
                  onClick={volver}
                  className="mt-3 flex w-full items-center justify-center gap-1.5 text-[12.5px] font-semibold text-white/45 transition hover:text-white/80"
                >
                  <ArrowLeft size={14} /> Volver
                </button>
              </>
            )}
          </div>
        </div>

        <p className="mt-4 text-center text-[12px] font-medium text-white/30">
          Plataforma omnicanal · WhatsApp, redes y chat interno
        </p>
      </div>
    </main>
  );
}
