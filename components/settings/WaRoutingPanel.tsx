"use client";

import { useEffect, useState } from "react";
import { Loader2, Radio, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { activeTenant } from "@/lib/tenants/active";
import { TENANTS } from "@/lib/tenants";
import type { TenantId } from "@/lib/tenants/types";

// Toggle del número de WhatsApp en vivo, POR CLIENTE. Cada dashboard solo se
// nombra a sí mismo (nunca al otro cliente): actívalo para que los mensajes de
// este número entren AQUÍ; al apagarlo el número queda libre para otro cliente.
// Por debajo escribe el enrutamiento global (wa_routing). Incluye "Borrar
// historial" para reiniciar la bandeja entre demos.
export function WaRoutingPanel() {
  const me = activeTenant();
  // El "otro" cliente al que pasa el número al apagar (no se muestra su nombre).
  const otroId =
    (Object.keys(TENANTS) as TenantId[]).find((id) => id !== me.id) ?? me.id;

  const [routing, setRouting] = useState<TenantId | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [limpiando, setLimpiando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/whatsapp/routing")
      .then((r) => r.json())
      .then((d) => setRouting(d.tenant))
      .catch(() => setRouting(null));
  }, []);

  const on = routing === me.id;

  async function toggle() {
    if (routing === null || guardando) return;
    const destino: TenantId = on ? otroId : (me.id as TenantId);
    const prev = routing;
    setRouting(destino);
    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/whatsapp/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: destino }),
      });
      const d = await r.json();
      if (!d.ok) {
        setRouting(prev);
        setMsg(d.error ?? "No se pudo cambiar.");
      } else {
        setMsg(
          destino === me.id
            ? "Activado. Los mensajes de este número entran aquí y la IA responde con su guion."
            : "En pausa. El número quedó libre para otro cliente.",
        );
      }
    } catch {
      setRouting(prev);
      setMsg("Error de red.");
    }
    setGuardando(false);
  }

  async function borrarHistorial() {
    if (!window.confirm("¿Borrar todo el historial de conversaciones de WhatsApp? No se puede deshacer.")) {
      return;
    }
    setLimpiando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/whatsapp/clear", { method: "POST" });
      const d = await r.json();
      setMsg(d.ok ? "Historial borrado. Recarga la bandeja para verla vacía." : "No se pudo borrar.");
    } catch {
      setMsg("Error de red.");
    }
    setLimpiando(false);
  }

  return (
    <div className="mb-4 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-[#0f1b2d]">
        <Radio size={16} className="text-brand" />
        Número de WhatsApp en vivo
      </div>
      <p className="mt-0.5 text-[12.5px] text-[#94a3b4]">
        Actívalo para que los mensajes de este número entren aquí y la IA responda con el guion de {me.brand.nombreCorto}. Al apagarlo, el número queda libre para otro cliente.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={routing === null || guardando}
          aria-pressed={on}
          title={on ? "Este número entra aquí" : "En pausa"}
          className={cn(
            "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition disabled:opacity-50",
            on
              ? "border-emerald-200 bg-emerald-50 text-[#2f9e2f]"
              : "border-line bg-white text-[#5b6b80] hover:border-[#cdd5df]",
          )}
        >
          <span>{on ? "Recibiendo aquí" : "En pausa"}</span>
          <span
            className={cn(
              "relative inline-flex h-4 w-7 items-center rounded-full transition",
              on ? "bg-[#2f9e2f]" : "bg-[#cdd5df]",
            )}
          >
            <span
              className={cn(
                "inline-block h-3 w-3 rounded-full bg-white shadow transition",
                on ? "translate-x-3.5" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
        {guardando && <Loader2 size={15} className="animate-spin text-[#94a3b4]" />}

        <button
          type="button"
          onClick={borrarHistorial}
          disabled={limpiando}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line bg-card px-2.5 py-1.5 text-[12px] font-semibold text-[#5b6b80] transition hover:border-red-200 hover:text-red-600 disabled:opacity-60"
        >
          {limpiando ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          Borrar historial
        </button>
      </div>

      {msg && <p className="mt-2 text-[12px] font-medium text-brand">{msg}</p>}
    </div>
  );
}
