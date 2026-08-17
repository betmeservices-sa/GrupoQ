// Logotipo de Banco Promerica.
//
// La estrella va en SVG en línea (los trazos son los del logotipo oficial, con
// los verdes de su design system: #00693C el cuerpo, #69BE28 la cola) y el
// "Banco Promerica" va como texto del DOM, no como imagen. Dos razones:
// el archivo que publica el banco es un JPG de 250x50 con fondo blanco quemado,
// que en una tarjeta se ve sucio; y así el nombre hereda la tipografía de la
// app y se ve nítido en cualquier pantalla.

export function PromericaEstrella({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={(size * 53) / 48}
      height={size}
      viewBox="0 0 53 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="m34.2,11.52c-9.32,9.15 -17.64,19.25 -25.12,29.94c13.33,-11.57 27.82,-21.79 43.41,-30.08l0,-0.02c-6.09,-0.24 -12.2,-0.19 -18.29,0.16z"
        fill="#69BE28"
      />
      <path
        d="m3.62,47.5l0.01,0c8.08,-13.3 17.46,-25.8 28.34,-36.93c-1.31,-3.4 -4.01,-10.19 -4.01,-10.19c-3.69,4.16 -6.95,8.66 -9.96,13.34c-5.8,1.32 -11.53,2.99 -17.07,5.18c0,0 7.04,4.78 10.5,7.24c-2.93,6.77 -7.53,20.53 -7.8,21.36l-0.01,0zm38.56,-1.94l0.01,0c-1.99,-7.4 -3.95,-14.79 -5.89,-22.2c-4.81,3.11 -9.51,6.36 -14.1,9.78c6.72,4.03 13.37,8.19 19.98,12.42z"
        fill="#00693C"
      />
    </svg>
  );
}

export function PromericaLogo({ compact = false }: { compact?: boolean }) {
  if (compact) return <PromericaEstrella size={26} />;

  return (
    <div className="flex items-center gap-2">
      <div className="leading-none">
        <p className="text-[17px] font-extrabold italic tracking-tight text-[#00693C]">
          Banco Promerica
        </p>
        <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--text-3)]">
          Gestión de cartera
        </p>
      </div>
      <PromericaEstrella size={26} />
    </div>
  );
}
