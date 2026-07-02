/* eslint-disable @next/next/no-img-element */

// Logo real de Grupo Q (descargado de grupoq.com para el demo).
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/grupoq-logo.webp"
      alt="Grupo Q, vas a llegar"
      className={compact ? "h-8 w-auto" : "h-11 w-auto"}
    />
  );
}
