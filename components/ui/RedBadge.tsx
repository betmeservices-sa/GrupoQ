import type { ComponentType } from "react";
import { Facebook, Instagram } from "lucide-react";
import { cn } from "@/lib/cn";
import { RED_NOMBRE } from "@/lib/social";
import type { RedSocial } from "@/lib/data/types";

// TikTok no viene en el set de íconos, así que va su glifo. Mismo tamaño y
// misma caja que los de lucide para que las tres redes se alineen.
export function TiktokIcon({ size = 13, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.6-1.62-.94-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03C3.23 21.76 1.81 19.58 1.6 17.24c-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.06z" />
    </svg>
  );
}

export type Glifo = ComponentType<{ size?: number; className?: string }>;

// Colores de cada red, los mismos que usa ChannelBadge para la bandeja.
export const RED_ICONO: Record<RedSocial, { Icon: Glifo; tono: string }> = {
  facebook: { Icon: Facebook, tono: "bg-[#1877F2]/12 text-[#1877F2]" },
  instagram: { Icon: Instagram, tono: "bg-[#E1306C]/12 text-[#c1275b]" },
  tiktok: { Icon: TiktokIcon, tono: "bg-[#FE2C55]/12 text-[#d42a4f]" },
};

export function RedBadge({
  red,
  showLabel = false,
  className,
}: {
  red: RedSocial;
  showLabel?: boolean;
  className?: string;
}) {
  const { Icon, tono } = RED_ICONO[red];
  const label = RED_NOMBRE[red];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tono,
        className,
      )}
      title={label}
    >
      <Icon size={13} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}
