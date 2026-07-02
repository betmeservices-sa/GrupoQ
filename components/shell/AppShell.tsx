"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Lock, Menu } from "lucide-react";
import { StoreProvider } from "@/lib/store";
import { LiveProvider } from "@/lib/live-context";
import { useRole, moduloDeRuta, primerModulo, MODULO_RUTA } from "@/lib/roles";
import { Sidebar } from "./Sidebar";
import { LiveMount } from "./LiveMount";

// Rutas públicas que NO llevan el chrome del dashboard (sidebar, store, etc.).
const PUBLIC_ROUTES = ["/privacy"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [navOpen, setNavOpen] = useState(false);
  const { def } = useRole();

  // Guard de rol: si la ruta actual es un módulo que este rol NO ve, lo
  // mandamos a su primer módulo permitido. null = ruta libre (no se restringe).
  const modulo = moduloDeRuta(pathname);
  const permitido = modulo === null || def.ve.includes(modulo);

  useEffect(() => {
    if (!permitido) router.replace(MODULO_RUTA[primerModulo(def)]);
  }, [permitido, def, router]);

  if (PUBLIC_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <StoreProvider>
      <LiveProvider>
        <LiveMount />
        <div className="flex h-screen overflow-hidden">
          {/* Overlay para cerrar el drawer en móvil */}
          {navOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
              onClick={() => setNavOpen(false)}
              aria-hidden
            />
          )}

          <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Barra superior solo en móvil */}
            <div className="flex items-center gap-3 border-b border-line bg-card px-4 py-2.5 lg:hidden">
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label="Abrir menú"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#5b6b80] transition hover:bg-surface"
              >
                <Menu size={22} />
              </button>
              <span className="text-sm font-extrabold tracking-tight text-[#0f1b2d]">
                Grupo Q
              </span>
            </div>

            <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {permitido ? children : <SinAcceso />}
            </main>
          </div>
        </div>
      </LiveProvider>
    </StoreProvider>
  );
}

function SinAcceso() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface text-[#94a3b4]">
        <Lock size={26} />
      </div>
      <p className="text-base font-bold text-[#0f1b2d]">Sección restringida</p>
      <p className="max-w-xs text-sm text-[#5b6b80]">
        Tu perfil no tiene acceso a esta sección. Te llevamos a tu vista.
      </p>
    </div>
  );
}
