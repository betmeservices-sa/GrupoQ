"use client";

// Cambiar de cliente, para las cuentas de la agencia.
//
// Solo aparece cuando la sesión trae la marca `todos` (tenant "*" en
// USUARIOS). Al elegir otro cliente se pide una sesión nueva al servidor, se
// guarda el tenant activo del navegador y se recarga: el panel entero se pinta
// con el otro cliente, como si hubiera entrado con su contraseña.

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { setActiveTenant } from "@/lib/tenants/active";
import { isTenantId } from "@/lib/tenants";

interface Cliente {
  id: string;
  nombre: string;
}

export function ClienteSwitcher() {
  const [estado, setEstado] = useState<{ tenant: string; clientes: Cliente[] } | null>(null);
  const [cambiando, setCambiando] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch("/api/auth/sesion", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { todos?: boolean; tenant?: string; clientes?: Cliente[] } | null) => {
        if (vivo && d?.todos && d.tenant && d.clientes?.length) {
          setEstado({ tenant: d.tenant, clientes: d.clientes });
        }
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  if (!estado) return null;

  async function cambiar(tenant: string) {
    if (!isTenantId(tenant) || tenant === estado?.tenant) return;
    setCambiando(true);
    try {
      const r = await fetch("/api/auth/cambiar-cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant }),
      });
      const d = await r.json().catch(() => ({ ok: false }));
      if (!d.ok) throw new Error(d.error ?? "No se pudo cambiar de cliente.");
      setActiveTenant(tenant);
      window.location.assign("/");
    } catch (e) {
      console.error(e);
      setCambiando(false);
    }
  }

  return (
    <label className="flex items-center gap-2 rounded-xl border border-line bg-surface px-2.5 py-2">
      <Building2 size={15} className="shrink-0 text-[var(--text-3)]" />
      <span className="sr-only">Cliente</span>
      <select
        value={estado.tenant}
        disabled={cambiando}
        onChange={(e) => void cambiar(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[12.5px] font-semibold text-[var(--text)] outline-none disabled:opacity-60"
        title="Cambiar de cliente"
      >
        {estado.clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
