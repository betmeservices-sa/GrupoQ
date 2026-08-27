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
import { Desplegable } from "@/components/ui/Desplegable";

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

  // Desplegable propio y no un <select>: el menú del select lo pinta Windows
  // fuera de la página (feo en modo oscuro y no se ve al compartir pantalla).
  // Abre hacia arriba porque vive al pie de la barra.
  return (
    <div className={"rounded-xl border border-line bg-surface/60 p-3" + (cambiando ? " pointer-events-none opacity-60" : "")}>
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
        <Building2 size={13} />
        Cliente
      </p>
      <Desplegable
        valor={estado.tenant}
        onChange={(v) => void cambiar(v)}
        etiquetaAria="Cambiar de cliente"
        arriba
        opciones={estado.clientes.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
      />
    </div>
  );
}
