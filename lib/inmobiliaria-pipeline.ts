// Pipeline de leads del tenant "inmobiliaria". Todo puro: la vista se arma con
// lo que se le pasa (leads + el día de hoy), sin tocar red ni reloj, para poder
// probarlo con fechas fijas.
//
// Venta y alquiler corren en tableros SEPARADOS. No es un rótulo distinto: el
// carril que califica cambia (forma de pago contra respaldo de la renta) y el
// dinero no es la misma unidad (precio total contra renta mensual). Sumarlos
// daría un número que no significa nada.

import {
  CARRILES,
  ETAPAS,
  urgenciaMudanza,
  type Carril,
  type Etapa,
  type Lead,
  type LeadSemilla,
  type Pipeline,
  type ResumenCarril,
  type ResumenEtapa,
  type TableroOperacion,
  type TipoOperacion,
  type Urgencia,
} from "./inmobiliaria-tipos";

const ZONA_SV = "America/El_Salvador";

export function hoyEnSv(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: ZONA_SV });
}

export function restarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const t = new Date(Date.UTC(a, m - 1, d));
  t.setUTCDate(t.getUTCDate() - dias);
  return t.toISOString().slice(0, 10);
}

export function sumarDias(fecha: string, dias: number): string {
  return restarDias(fecha, -dias);
}

// Cuántos días pasaron entre dos fechas AAAA-MM-DD.
export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000);
}

// Un lead cerrado ya no corre. Uno "no calificado" tampoco se juzga con la misma
// vara: no puede comprar todavía, así que su reloj es de meses, no de días. El
// resto se enfría rápido, que es de lo que se trata este tablero.
export function urgenciaDe(etapa: Etapa, dias: number): Urgencia {
  if (etapa === "cerrado") return "al_dia";
  if (etapa === "no_calificado") {
    if (dias >= 90) return "abandonado";
    if (dias >= 45) return "enfriando";
    return "al_dia";
  }
  if (dias >= 10) return "abandonado";
  if (dias >= 4) return "enfriando";
  return "al_dia";
}

// El carril del lead: en venta la forma de pago, en alquiler lo que respalda la
// renta. Lo que no se preguntó cae en "sin definir", nunca se asume.
export function carrilDe(l: Pick<LeadSemilla, "operacion" | "formaPago" | "respaldo">): Carril {
  return l.operacion === "alquiler" ? (l.respaldo ?? "sin_definir") : (l.formaPago ?? "sin_definir");
}

export function resolverLead(semilla: LeadSemilla, hoy: string): Lead {
  const dias = Math.max(0, Math.round(semilla.hace));
  const mudanzaEnDias = semilla.operacion === "alquiler" ? semilla.mudanzaEnDias : undefined;
  return {
    ...semilla,
    dias,
    ultimoContacto: restarDias(hoy, dias),
    urgencia: urgenciaDe(semilla.etapa, dias),
    carril: carrilDe(semilla),
    mudanza: urgenciaMudanza(mudanzaEnDias),
    mudanzaEl: typeof mudanzaEnDias === "number" ? sumarDias(hoy, mudanzaEnDias) : undefined,
  };
}

export function soloDe(leads: Lead[], operacion: TipoOperacion): Lead[] {
  return leads.filter((l) => l.operacion === operacion);
}

// Los carriles de una operación, siempre los cuatro, aunque alguno vaya en cero:
// una columna vacía también dice algo (nadie con fiador, por ejemplo).
export function resumirPorCarril(leads: Lead[], operacion: TipoOperacion): ResumenCarril[] {
  return CARRILES[operacion].map((carril) => {
    const propios = leads.filter((l) => l.carril === carril);
    return {
      carril,
      leads: propios.length,
      monto: propios.reduce((s, l) => s + l.presupuesto, 0),
    };
  });
}

export function resumirPorEtapa(leads: Lead[]): ResumenEtapa[] {
  return ETAPAS.map((etapa) => {
    const propios = leads.filter((l) => l.etapa === etapa);
    return {
      etapa,
      leads: propios.length,
      monto: propios.reduce((s, l) => s + l.presupuesto, 0),
    };
  });
}

// Los que ya se enfriaron y siguen vivos: la cuenta que obliga a llamar hoy.
export function contarSinTocar(leads: Lead[]): number {
  return leads.filter((l) => l.etapa !== "cerrado" && l.urgencia !== "al_dia").length;
}

// Dinero de los leads que todavía se pueden ganar. Los cerrados ya no están en
// juego y los no calificados no pueden hoy: ninguno de los dos suma. En alquiler
// el resultado es renta AL MES, no un total.
export function dineroEnJuego(leads: Lead[]): number {
  return leads
    .filter((l) => l.etapa !== "cerrado" && l.etapa !== "no_calificado")
    .reduce((s, l) => s + l.presupuesto, 0);
}

// Dentro de una columna manda el abandono: primero el que lleva más tiempo sin
// que nadie lo toque.
export function ordenarPorAbandono(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => b.dias - a.dias || b.presupuesto - a.presupuesto);
}

export function agruparPorEtapa(leads: Lead[]): Record<Etapa, Lead[]> {
  const mapa = {} as Record<Etapa, Lead[]>;
  for (const etapa of ETAPAS) {
    mapa[etapa] = ordenarPorAbandono(leads.filter((l) => l.etapa === etapa));
  }
  return mapa;
}

// La matriz que pide el tablero: carril por etapa, sin perder ninguna de las dos
// dimensiones. Los carriles salen de la operación, así que un tablero de
// alquiler nunca muestra una fila de FSV.
export function agruparPorCarrilYEtapa(
  leads: Lead[],
  operacion: TipoOperacion,
): Record<Carril, Record<Etapa, Lead[]>> {
  const mapa = {} as Record<Carril, Record<Etapa, Lead[]>>;
  for (const carril of CARRILES[operacion]) {
    mapa[carril] = agruparPorEtapa(leads.filter((l) => l.carril === carril));
  }
  return mapa;
}

export function armarTablero(leads: Lead[], operacion: TipoOperacion): TableroOperacion {
  const propios = soloDe(leads, operacion);
  return {
    operacion,
    leads: propios,
    porCarril: resumirPorCarril(propios, operacion),
    porEtapa: resumirPorEtapa(propios),
    sinTocar: contarSinTocar(propios),
    enJuego: dineroEnJuego(propios),
  };
}

export function construirPipeline(entrada: { leads: LeadSemilla[]; hoy: string }): Pipeline {
  const leads = entrada.leads.map((l) => resolverLead(l, entrada.hoy));
  return {
    hoy: entrada.hoy,
    leads,
    venta: armarTablero(leads, "venta"),
    alquiler: armarTablero(leads, "alquiler"),
    sinTocar: contarSinTocar(leads),
  };
}
