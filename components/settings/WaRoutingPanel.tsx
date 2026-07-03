"use client";

import { useEffect, useState } from "react";
import { Loader2, Radio, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { TENANTS } from "@/lib/tenants";
import type { TenantId } from "@/lib/tenants/types";

// Switch de enrutamiento del número de WhatsApp en vivo. Hay UN solo número:
// aquí se elige a qué cliente entran sus mensajes (dashboard + guion de IA).
// Es un ajuste GLOBAL (lo ven ambos dashboards). Incluye "Borrar historial"
// para reiniciar la bandeja entre demos.
const ORDEN: TenantId[] = ["hospital", "grupoq"];

export function WaRoutingPanel() {
  const [tenant, setTenant] = useState<TenantId | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [limpiando, setLimpiando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/whatsapp/routing")
      .then((r) => r.json())
      .then((d) => setTenant(d.tenant))
      .catch(() => setTenant(null));
  }, []);

  async function elegir(t: TenantId) {
    if (t === tenant || guardando) return;
    const prev = tenant;
    setTenant(t);
    setGuardando(true);
    setMsg(null);
    try {
      const r = await fetch("/api/whatsapp/routing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: t }),
      });
      const d = await r.json();
      if (!d.ok) {
        setTenant(prev);
        setMsg(d.error ?? "No se pudo cambiar.");
      } else {
        setMsg(`Listo. Los mensajes nuevos del número entran a ${TENANTS[t].brand.nombreCorto} y la IA responde con su guion.`);
      }
    } catch {
      setTenant(prev);
      setMsg("Error de red.");
    }
    setGuardando(false);
  }

  async function borrarHistorial() {
    if (!window.confirm("¿Borrar todo el historial de conversaciones de WhatsApp de este cliente? No se puede deshacer.")) {
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
        Hay un solo número. Elige a qué cliente entran sus mensajes: se muestran en ese dashboard y la IA responde con su guion. Los mensajes ya recibidos no se mueven.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          {ORDEN.map((t) => {
            const on = tenant === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => elegir(t)}
                disabled={tenant === null || guardando}
                aria-pressed={on}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition disabled:opacity-60",
                  on ? "bg-brand text-white shadow-sm" : "text-[#5b6b80] hover:text-[#0f1b2d]",
                )}
              >
                {TENANTS[t].brand.nombreCorto}
              </button>
            );
          })}
        </div>
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
