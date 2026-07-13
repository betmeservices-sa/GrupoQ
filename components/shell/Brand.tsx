/* eslint-disable @next/next/no-img-element */
"use client";

import { HeartPulse, CarFront, Bot } from "lucide-react";
import { activeTenant } from "@/lib/tenants/active";

const WORDMARK_ICONS = { HeartPulse, CarFront, Bot } as const;

// Marca del tenant ACTIVO. Si el tenant trae logoSrc, pinta el logo real; si no,
// pinta un wordmark (ícono + nombre + lema). Se usa dentro del shell, cuando ya
// hay sesión y [data-tenant] está fijado.
export function Brand({ compact = false }: { compact?: boolean }) {
  const { brand } = activeTenant();

  if (brand.logoSrc) {
    return (
      <img
        src={brand.logoSrc}
        alt={brand.logoAlt ?? brand.nombre}
        className={compact ? "h-8 w-auto" : "h-11 w-auto"}
      />
    );
  }

  const Icon = brand.wordmark ? WORDMARK_ICONS[brand.wordmark.icon] : HeartPulse;
  const titulo = brand.wordmark?.titulo ?? brand.nombreCorto;
  const subtitulo = brand.wordmark?.subtitulo ?? brand.tagline;

  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
        <Icon size={20} strokeWidth={2.4} />
      </span>
      {!compact && (
        <div className="leading-tight">
          <p className="text-[15px] font-extrabold tracking-tight text-[#0f1b2d]">{titulo}</p>
          <p className="text-[11px] font-medium text-brand">{subtitulo}</p>
        </div>
      )}
    </div>
  );
}
