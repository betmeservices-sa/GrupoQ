// Logotipo de YALÍ Hotel & Resort.
//
// Se dibuja en SVG en vez de usar el archivo del hotel por una razón práctica:
// el que publican es un JPG con el azul de marca quemado de fondo, y sobre la
// tarjeta blanca del panel se vería como un recuadro azul pegado. Redibujado
// con trazos hereda el color del tema (azul sobre claro, blanco sobre azul) y
// se ve nítido en cualquier pantalla.
//
// Las letras son de trazo fino y ancho de interletrado grande, como el original,
// y bajo la A va la barra de cobre que lleva el logotipo.

export function YaliMarca({ height = 44 }: { height?: number }) {
  return (
    <svg
      height={height}
      // El viewBox lleva margen a los cuatro lados: sin él, la mitad del trazo
      // de la Y y de la I queda fuera del lienzo y el logotipo se ve cortado.
      viewBox="-6 -6 492 248"
      fill="none"
      role="img"
      aria-label="YALÍ Hotel & Resort"
      style={{ width: (height * 492) / 248 }}
    >
      <g
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      >
        {/* Y */}
        <path d="M2 4 L67 92 L132 4" />
        <path d="M67 92 L67 175" />
        {/* A */}
        <path d="M155 175 L222 4 L289 175" />
        <path d="M173 128 L271 128" />
        {/* L */}
        <path d="M312 4 L312 175 L400 175" />
        {/* I */}
        <path d="M452 4 L452 175" />
      </g>
      {/* La barra de cobre bajo la A, el único acento de color del logotipo. */}
      <rect x="155" y="186" width="120" height="7" fill="var(--brand-accent)" />
      <text
        x="240"
        y="228"
        textAnchor="middle"
        fill="currentColor"
        fontSize="26"
        letterSpacing="11"
        fontFamily="var(--font-sans), system-ui, sans-serif"
        fontWeight="400"
      >
        HOTEL &amp; RESORT
      </text>
    </svg>
  );
}

export function YaliLogo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="text-brand">
      <YaliMarca height={compact ? 26 : 40} />
    </span>
  );
}
