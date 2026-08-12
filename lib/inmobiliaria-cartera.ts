// Cartera de propiedades del tenant "inmobiliaria". Puro: recibe las fichas, los
// leads y el día de hoy, y devuelve la vista con las alertas ya resueltas. Los
// datos vivos (semillas + lo que se dio de alta desde el teléfono) los junta
// inmobiliaria-store, que es lo único que toca estado.
//
// La alerta que importa: una propiedad APARTADA o VENDIDA que sigue publicada.
// Es el error caro y frecuente del oficio (se sigue pagando pauta, entran leads
// por algo que ya no se puede vender y el agente queda mal con el cliente).

import { diasEntre, sumarDias } from "./inmobiliaria-pipeline";
import type {
  Cartera,
  EstadoPropiedad,
  LeadSemilla,
  Propiedad,
  PropiedadSemilla,
  TipoOperacion,
  TipoPropiedad,
} from "./inmobiliaria-tipos";

// Una exclusiva que vence en menos de esto ya hay que renovarla con el
// propietario, o la propiedad se va con otra inmobiliaria.
export const DIAS_AVISO_EXCLUSIVA = 30;

// Un lead sigue "vivo" sobre una propiedad mientras pueda tomarla. El cerrado ya
// la tomó y el no calificado no puede todavía.
function vivo(l: LeadSemilla): boolean {
  return l.etapa !== "cerrado" && l.etapa !== "no_calificado";
}

export function resolverPropiedad(
  semilla: PropiedadSemilla,
  hoy: string,
  leads: LeadSemilla[],
): Propiedad {
  const tieneVence = semilla.exclusiva && typeof semilla.exclusivaEnDias === "number";
  const diasDeExclusiva = tieneVence ? semilla.exclusivaEnDias! : undefined;
  return {
    ...semilla,
    exclusivaHasta: tieneVence ? sumarDias(hoy, semilla.exclusivaEnDias!) : undefined,
    diasDeExclusiva,
    publicadaSinEstar: semilla.publicada && semilla.estado !== "disponible",
    exclusivaVencida: tieneVence && diasDeExclusiva! < 0,
    exclusivaPorVencer:
      tieneVence && diasDeExclusiva! >= 0 && diasDeExclusiva! <= DIAS_AVISO_EXCLUSIVA,
    interesados: leads.filter((l) => l.propiedadId === semilla.id && vivo(l)).length,
  };
}

export function construirCartera(entrada: {
  propiedades: PropiedadSemilla[];
  leads: LeadSemilla[];
  hoy: string;
}): Cartera {
  const propiedades = entrada.propiedades.map((p) =>
    resolverPropiedad(p, entrada.hoy, entrada.leads),
  );
  const por = (e: EstadoPropiedad) => propiedades.filter((p) => p.estado === e);
  const disponibles = por("disponible");
  const de = (op: TipoOperacion) => disponibles.filter((p) => p.operacion === op);
  return {
    hoy: entrada.hoy,
    propiedades,
    resumen: {
      total: propiedades.length,
      disponibles: disponibles.length,
      apartadas: por("apartada").length,
      vendidas: por("vendida").length,
      enVenta: de("venta").length,
      enAlquiler: de("alquiler").length,
      // Dos bolsas separadas a propósito: el precio de una casa en venta y la
      // renta mensual de un apartamento no se suman.
      valorVenta: de("venta").reduce((s, p) => s + p.precio, 0),
      rentaMensual: de("alquiler").reduce((s, p) => s + p.precio, 0),
      exclusivas: propiedades.filter((p) => p.exclusiva).length,
    },
    alertas: {
      publicadasSinEstar: propiedades.filter((p) => p.publicadaSinEstar).map((p) => p.codigo),
      exclusivasVencidas: propiedades.filter((p) => p.exclusivaVencida).map((p) => p.codigo),
      exclusivasPorVencer: propiedades.filter((p) => p.exclusivaPorVencer).map((p) => p.codigo),
    },
  };
}

export interface FiltroCartera {
  operacion?: TipoOperacion | "todas";
  tipo?: TipoPropiedad | "todos";
  estado?: EstadoPropiedad | "todos";
  zona?: string;
  texto?: string;
}

export function filtrarCartera(propiedades: Propiedad[], f: FiltroCartera): Propiedad[] {
  const texto = (f.texto ?? "").trim().toLowerCase();
  return propiedades.filter((p) => {
    if (f.operacion && f.operacion !== "todas" && p.operacion !== f.operacion) return false;
    if (f.tipo && f.tipo !== "todos" && p.tipo !== f.tipo) return false;
    if (f.estado && f.estado !== "todos" && p.estado !== f.estado) return false;
    if (f.zona && f.zona !== "todas" && p.municipio !== f.zona) return false;
    if (texto) {
      const heno = `${p.codigo} ${p.titulo} ${p.zona} ${p.municipio} ${p.propietario.nombre}`.toLowerCase();
      if (!heno.includes(texto)) return false;
    }
    return true;
  });
}

// Días que faltan para que venza una exclusiva, contra una fecha dada.
export function diasParaVencer(exclusivaHasta: string, hoy: string): number {
  return diasEntre(hoy, exclusivaHasta);
}
