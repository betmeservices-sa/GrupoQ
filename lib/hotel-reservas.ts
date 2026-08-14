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
let store: ReservaSimulada[] = [];

// ── Por qué esto se guarda en disco ──
// Vivía solo en memoria y se perdía en cada recompilación del servidor: se
// reservaba, se cambiaba de pantalla y la reserva ya no estaba. Para una
// demostración eso es fatal, porque parece que el sistema perdió el dato.
// El archivo es local y descartable; en producción no existe y se sigue
// trabajando en memoria, sin romper nada.
const ARCHIVO = "reservas-demo.json";
let cargado = false;

function rutaArchivo(): string | null {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const path = require("node:path") as typeof import("node:path");
    return path.join(process.cwd(), ".next", "cache", ARCHIVO);
  } catch {
    return null;
  }
}

function cargar(): void {
  if (cargado) return;
  cargado = true;
  const ruta = rutaArchivo();
  if (!ruta) return;
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    if (!fs.existsSync(ruta)) return;
    const datos = JSON.parse(fs.readFileSync(ruta, "utf8"));
    if (Array.isArray(datos)) store = datos.slice(0, MAX);
  } catch {}
}

function guardar(): void {
  const ruta = rutaArchivo();
  if (!ruta) return;
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    fs.mkdirSync(path.dirname(ruta), { recursive: true });
    fs.writeFileSync(ruta, JSON.stringify(store), "utf8");
  } catch {}
}

function nuevoId(): string {
  return `SIM-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function crearReservaSimulada(
  r: Omit<ReservaSimulada, "id" | "creada">,
): ReservaSimulada {
  cargar();
  const reserva: ReservaSimulada = { ...r, id: nuevoId(), creada: new Date().toISOString() };
  store.unshift(reserva);
  if (store.length > MAX) store.length = MAX;
  guardar();
  return reserva;
}

export function listarReservasSimuladas(): ReservaSimulada[] {
  cargar();
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
  cargado = true;
  store = [];
  guardar();
}

// ¿Ya hay una reserva del demo en esa habitación que pise alguna de estas
// noches? Dos estadías que se tocan solo en el día de salida NO se solapan: esa
// noche ya la liberó quien se va. Se valida en el servidor, no en la pantalla.
export function solapeSimulado(
  tipoId: string,
  desde: string,
  hasta: string,
): ReservaSimulada | null {
  cargar();
  return store.find((r) => r.tipoId === tipoId && r.desde < hasta && desde < r.hasta) ?? null;
}
