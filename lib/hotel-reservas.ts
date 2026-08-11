// Reservas SIMULADAS del demo del hotel.
//
// El agente de IA consulta disponibilidad y tarifas REALES en el PMS, pero
// cuando el huésped dice "resérvamela" la reserva se guarda AQUÍ, en memoria del
// demo, y no en Cloudbeds (ver la frontera de lib/cloudbeds.ts: escribir en el
// PMS sincronizaría al channel manager y bloquearía inventario real).
//
// Por eso el dashboard las pinta con su propio estado "simulada": nunca se
// confunden con las reservas verdaderas que devuelve el PMS.
//
// Vive en memoria del proceso a propósito: es estado de demostración y se
// reinicia solo. Si algún día tiene que sobrevivir a un reinicio (o compartirse
// entre funciones separadas), el reemplazo es una tabla en la misma base que ya
// usa wa-store, no una llamada al PMS.

export interface ReservaSimulada {
  id: string;
  huesped: string;
  telefono?: string;
  tipoId: string; // roomTypeID del PMS
  tipoNombre: string;
  desde: string; // AAAA-MM-DD (check in)
  hasta: string; // AAAA-MM-DD (check out)
  adultos: number;
  ninos: number;
  tarifaTotal: number; // la que devolvió el PMS al consultar, sin recalcular
  creada: string; // ISO 8601
  origen: "agente" | "panel";
}

const MAX = 100;
const store: ReservaSimulada[] = [];

function nuevoId(): string {
  return `SIM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function crearReservaSimulada(
  r: Omit<ReservaSimulada, "id" | "creada">,
): ReservaSimulada {
  const reserva: ReservaSimulada = { ...r, id: nuevoId(), creada: new Date().toISOString() };
  store.unshift(reserva);
  if (store.length > MAX) store.length = MAX;
  return reserva;
}

export function listarReservasSimuladas(): ReservaSimulada[] {
  return [...store];
}

// Noches que ocupa una reserva simulada, para pintarlas en el calendario.
export function nochesDe(r: ReservaSimulada): string[] {
  const out: string[] = [];
  const fin = Date.parse(`${r.hasta}T00:00:00Z`);
  let cur = Date.parse(`${r.desde}T00:00:00Z`);
  while (cur < fin && out.length < 60) {
    out.push(new Date(cur).toISOString().slice(0, 10));
    cur += 86400000;
  }
  return out;
}

export function borrarReservasSimuladas(): void {
  store.length = 0;
}
