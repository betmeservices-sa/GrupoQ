import { Facebook, Instagram, MessageCircle, Users } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Channel } from "@/lib/data/types";

const MAP: Record<
  Channel,
  { label: string; Icon: typeof MessageCircle; className: string }
> = {
  whatsapp: { label: "WhatsApp", Icon: MessageCircle, className: "bg-[#25D366]/12 text-[#1ba34d]" },
  instagram: { label: "Instagram", Icon: Instagram, className: "bg-[#E1306C]/12 text-[#c1275b]" },
  facebook: { label: "Facebook", Icon: Facebook, className: "bg-[#1877F2]/12 text-[#1877F2]" },
  internal: { label: "Interno", Icon: Users, className: "bg-slate-200 text-slate-600" },
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
      <Icon size={13} strokeWidth={2.2} />
      {showLabel && <span>{label}</span>}
    </span>
  );
}
