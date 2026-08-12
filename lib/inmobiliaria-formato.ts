// Formato de números y fechas del tablero inmobiliario. El Salvador usa dólar,
// así que todo el dinero va en USD sin centavos: nadie cotiza una casa en 425
// mil con dos decimales.

export function dinero(v: number): string {
  return `$${Math.round(v).toLocaleString("en-US")}`;
}

// La renta va SIEMPRE con el "al mes" pegado. Un "$650" suelto al lado de un
// "$425,000" hace que alguien lea la renta como precio de venta.
export function dineroMes(v: number): string {
  return `${dinero(v)}/mes`;
}

// El precio como se dice según la operación, para no tener que repetir el if.
export function precioDe(p: { operacion: "venta" | "alquiler"; precio: number }): string {
  return p.operacion === "alquiler" ? dineroMes(p.precio) : dinero(p.precio);
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

// Igual que el anterior, pero deja claro que es renta mensual.
export function dineroCortoMes(v: number): string {
  return `${dineroCorto(v)}/mes`;
}

// Un plazo de contrato como lo dice el agente: "12 meses" suena a formulario,
// "un año" suena a persona.
export function plazo(meses: number): string {
  if (meses <= 0) return "";
  if (meses === 12) return "un año";
  if (meses === 24) return "dos años";
  if (meses === 1) return "un mes";
  if (meses % 12 === 0) return `${meses / 12} años`;
  return `${meses} meses`;
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
