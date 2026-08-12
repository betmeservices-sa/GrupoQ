// Cartera de propiedades del tenant "inmobiliaria". Puro: recibe las fichas, los
// leads y el día de hoy, y devuelve la vista con las alertas ya resueltas.
//
// La alerta que importa: una propiedad APARTADA o VENDIDA que sigue publicada.
// Es el error caro y frecuente del oficio (se sigue pagando pauta, entran leads
// por algo que ya no se puede vender y el agente queda mal con el cliente).

import { LEADS, PROPIEDADES } from "./inmobiliaria-datos";
import { diasEntre, hoyEnSv, sumarDias } from "./inmobiliaria-pipeline";
import type {
  Cartera,
  EstadoPropiedad,
  LeadSemilla,
  Propiedad,
  PropiedadSemilla,
  TipoPropiedad,
} from "./inmobiliaria-tipos";

// Una exclusiva que vence en menos de esto ya hay que renovarla con el
// propietario, o la propiedad se va con otra inmobiliaria.
export const DIAS_AVISO_EXCLUSIVA = 30;

// Un lead sigue "vivo" sobre una propiedad mientras pueda comprarla. El cerrado
// ya compró y el no calificado no puede todavía.
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
  return {
    hoy: entrada.hoy,
    propiedades,
    resumen: {
      total: propiedades.length,
      disponibles: por("disponible").length,
      apartadas: por("apartada").length,
      vendidas: por("vendida").length,
      valorDisponible: por("disponible").reduce((s, p) => s + p.precio, 0),
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
  tipo?: TipoPropiedad | "todos";
  estado?: EstadoPropiedad | "todos";
  zona?: string;
  texto?: string;
}

export function filtrarCartera(propiedades: Propiedad[], f: FiltroCartera): Propiedad[] {
  const texto = (f.texto ?? "").trim().toLowerCase();
  return propiedades.filter((p) => {
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

export function cargarCartera(hoy = hoyEnSv()): Cartera {
  return construirCartera({ propiedades: PROPIEDADES, leads: LEADS, hoy });
}

export function buscarPropiedad(id: string, hoy = hoyEnSv()): Propiedad | null {
  const semilla = PROPIEDADES.find((p) => p.id === id || p.codigo.toLowerCase() === id.toLowerCase());
  return semilla ? resolverPropiedad(semilla, hoy, LEADS) : null;
}
