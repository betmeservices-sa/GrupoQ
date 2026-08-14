import { Users } from "lucide-react";
import { cn } from "@/lib/cn";
import { FacebookIcon, InstagramIcon, WhatsappIcon, type Glifo } from "./glifos";
import type { Channel } from "@/lib/data/types";

const MAP: Record<Channel, { label: string; Icon: Glifo; className: string }> = {
  whatsapp: { label: "WhatsApp", Icon: WhatsappIcon, className: "bg-[#25D366]/12 text-[#1ba34d]" },
  instagram: { label: "Instagram", Icon: InstagramIcon, className: "bg-[#E1306C]/12 text-[#c1275b]" },
  facebook: { label: "Facebook", Icon: FacebookIcon, className: "bg-[#1877F2]/12 text-[#1877F2]" },
  internal: { label: "Interno", Icon: Users, className: "bg-surface-2 text-slate-600" },
};

export function ChannelBadge({
  channel,
  showLabel = false,
  className,
}: {
  channel: Channel;
  showLabel?: boolean;
  className?: string;
}) {
  const { label, Icon, className: tone } = MAP[channel];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
      title={label}
    >
      <Icon size={13} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}
