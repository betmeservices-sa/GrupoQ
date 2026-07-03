import { cn } from "@/lib/cn";

export function Avatar({
  iniciales,
  color,
  size = 36,
  className,
}: {
  iniciales: string;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        backgroundColor: color ?? "var(--brand-blue)",
      }}
      aria-hidden
    >
      {iniciales}
    </span>
  );
}

// Deriva iniciales de un nombre ("María Elena Vásquez" -> "MV").
export function inicialesDe(nombre: string): string {
  const limpio = nombre.replace(/^@/, "").replace(/[^\p{L}\s.]/gu, " ").trim();
  const partes = limpio.split(/[\s.]+/).filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
