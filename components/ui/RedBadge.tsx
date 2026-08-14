import { cn } from "@/lib/cn";
import { RED_NOMBRE } from "@/lib/social";
import { FacebookIcon, InstagramIcon, TiktokIcon, type Glifo } from "./glifos";
import type { RedSocial } from "@/lib/data/types";

export { TiktokIcon, type Glifo };

// Colores de cada red, los mismos que usa ChannelBadge para la bandeja.
export const RED_ICONO: Record<RedSocial, { Icon: Glifo; tono: string }> = {
  facebook: { Icon: FacebookIcon, tono: "bg-[#1877F2]/12 text-[#1877F2]" },
  instagram: { Icon: InstagramIcon, tono: "bg-[#E1306C]/12 text-[#c1275b]" },
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
