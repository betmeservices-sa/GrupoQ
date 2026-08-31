"use client";

// Conectar el número de WhatsApp del negocio desde el panel.
//
// Abre el diálogo oficial de Meta para WhatsApp (Embedded Signup): el cliente
// elige su cuenta y su número, Meta lo verifica por SMS, y al cerrar nos deja
// un `code` y los ids. Eso va a /api/whatsapp/connect, que hace el resto.
//
// Es un botón aparte del de Facebook e Instagram porque Meta lo maneja en otro
// diálogo, con otros permisos y el paso del SMS en medio. Para el cliente
// sigue siendo la misma pantalla y un clic.

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Trash2 } from "lucide-react";

interface Numero {
  phoneNumberId: string;
  numero: string | null;
  nombre: string | null;
}

// Lo que Meta le pasa a la ventana al terminar el diálogo.
interface MensajeMeta {
  type?: string;
  event?: string;
  data?: { waba_id?: string; phone_number_id?: string; current_step?: string };
}

declare global {
  interface Window {
    FB?: {
      init: (o: { appId: string; version: string }) => void;
      login: (
        cb: (r: { authResponse?: { code?: string } }) => void,
        opts: Record<string, unknown>,
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
const CONFIG_ID = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID ?? "";

export function ConectarWhatsApp() {
  const [numeros, setNumeros] = useState<Numero[] | null>(null);
  const [sdkListo, setSdkListo] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  // Los ids llegan por un canal y el code por otro; se juntan acá.
  const ids = useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  const cargar = useCallback(async () => {
    const r = await fetch("/api/whatsapp/connect", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    setNumeros(j.numeros ?? []);
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  // El SDK de Facebook, una sola vez.
  useEffect(() => {
    if (!APP_ID || !CONFIG_ID) return;
    if (window.FB) {
      setSdkListo(true);
      return;
    }
    window.fbAsyncInit = () => {
      window.FB?.init({ appId: APP_ID, version: "v21.0" });
      setSdkListo(true);
    };
    const s = document.createElement("script");
    s.src = "https://connect.facebook.net/es_LA/sdk.js";
    s.async = true;
    s.defer = true;
    document.body.appendChild(s);
  }, []);

  // Meta manda los ids del número por un mensaje de ventana.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!/\.facebook\.com$/.test(new URL(e.origin).hostname)) return;
      let d: MensajeMeta;
      try {
        d = typeof e.data === "string" ? (JSON.parse(e.data) as MensajeMeta) : (e.data as MensajeMeta);
      } catch {
        return;
      }
      if (d?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (d.event === "FINISH" && d.data) {
        ids.current = { wabaId: d.data.waba_id, phoneNumberId: d.data.phone_number_id };
      } else if (d.event === "CANCEL") {
        setAviso("Se cerró la ventana de Meta antes de terminar.");
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function conectar() {
    if (!window.FB) return;
    setAviso(null);
    ids.current = {};
    window.FB.login(
      (r) => {
        const code = r.authResponse?.code;
        if (!code) {
          setAviso("No se completó la autorización.");
          return;
        }
        // Los ids pueden llegar un instante después del code.
        let intentos = 0;
        const esperar = () => {
          if (ids.current.wabaId && ids.current.phoneNumberId) {
            void terminar(code, ids.current.wabaId, ids.current.phoneNumberId);
          } else if (intentos++ < 20) {
            setTimeout(esperar, 250);
          } else {
            setAviso("Meta no devolvió los datos del número. Volvé a intentar.");
          }
        };
        esperar();
      },
      {
        config_id: CONFIG_ID,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }

  async function terminar(code: string, wabaId: string, phoneNumberId: string) {
    setTrabajando(true);
    try {
      const r = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, wabaId, phoneNumberId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) {
        setAviso(j.error ?? "No se pudo conectar el número.");
        return;
      }
      setAviso(
        j.registrado && j.suscrita
          ? `Listo: ${j.numero ?? "el número"} ya recibe y manda desde acá.`
          : `Se conectó ${j.numero ?? "el número"}, pero Meta no terminó de activarlo. Avisanos.`,
      );
      await cargar();
    } finally {
      setTrabajando(false);
    }
  }

  async function quitar(phoneNumberId: string) {
    await fetch("/api/whatsapp/connect", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phoneNumberId }),
    });
    await cargar();
  }

  const disponible = Boolean(APP_ID && CONFIG_ID);

  return (
    <div className="mb-4 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-bold text-[var(--text)]">
            <MessageCircle size={16} className="text-brand" />
            Conexión · WhatsApp
          </div>
          <p className="mt-1 max-w-xl text-[12.5px] text-[var(--text-2)]">
            Conecta el número de WhatsApp del negocio para recibir y responder desde esta
            bandeja. Se abre la pantalla oficial de Meta: elegís el número y lo confirmás con
            un código por SMS.
          </p>
        </div>
        <button
          type="button"
          onClick={conectar}
          disabled={!disponible || !sdkListo || trabajando}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-brand/25 transition hover:brightness-105 disabled:opacity-60"
        >
          {trabajando ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
          {trabajando
            ? "Conectando"
            : numeros && numeros.length
              ? "Agregar otro número"
              : "Conectar WhatsApp"}
        </button>
      </div>

      {!disponible && (
        <p className="mt-3 text-[12px] text-[var(--text-3)]">
          La conexión de WhatsApp todavía no está habilitada en este panel.
        </p>
      )}

      {numeros && numeros.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {numeros.map((n) => (
            <li
              key={n.phoneNumberId}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[12.5px] text-[var(--text-1)]"
            >
              <span className="font-semibold">{n.numero ?? n.phoneNumberId}</span>
              {n.nombre && <span className="text-[var(--text-3)]">{n.nombre}</span>}
              <button
                type="button"
                onClick={() => void quitar(n.phoneNumberId)}
                aria-label="Quitar este número"
                className="text-[var(--text-3)] hover:text-[var(--danger,#e5484d)]"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {aviso && <p className="mt-3 text-[12.5px] text-[var(--text-2)]">{aviso}</p>}
    </div>
  );
}
