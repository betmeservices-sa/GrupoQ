// Formato de números y fechas del tablero inmobiliario. El Salvador usa dólar,
// así que todo el dinero va en USD sin centavos: nadie cotiza una casa en 425
// mil con dos decimales.

export function dinero(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

// Para los totales de columna, donde no cabe el número completo.
export function dineroCorto(v: number): string {
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return `$${m < 10 ? m.toFixed(1) : Math.round(m)}M`;
  }
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${Math.round(v)}`;
}

export function fechaCorta(fecha: string): string {
  if (!fecha) return "";
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

export function fechaLarga(fecha: string): string {
  if (!fecha) return "";
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

// "hoy", "ayer", "hace 5 días", "hace 2 meses". Es el dato que hace actuar al
// agente, así que se escribe como lo diría él.
export function desdeHace(dias: number): string {
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 30) return `hace ${dias} días`;
  const meses = Math.round(dias / 30);
  return meses === 1 ? "hace un mes" : `hace ${meses} meses`;
}

// Superficie con la unidad que usa la escritura salvadoreña: la vara cuadrada
// para el terreno, el metro cuadrado para lo construido.
export function varas(v: number): string {
  return `${v.toLocaleString("en-US")} v²`;
}

export function metros(v: number): string {
  return `${v.toLocaleString("en-US")} m²`;
}
