// Reservas que cierra Sofía en el demo de Yali Hospitality.
//
// El libro de ocupación (lib/yali-pms.ts) es determinista y no se puede
// escribir: es el retrato del hotel. Lo que el agente confirma por WhatsApp se
// guarda AQUÍ y se superpone a ese libro, igual que hace el hotel de Antigua
// con su PMS. Cuando Yali entregue las llaves de Cloudbeds, esta separación es
// la que evita que un demo escriba en el inventario real del cliente y le
// bloquee noches en Booking.
//
// Vive en memoria del proceso, con copia en disco solo en desarrollo: es estado
// de demostración y se reinicia solo. Si algún día tiene que sobrevivir a un
// reinicio o compartirse entre funciones separadas, el reemplazo es una tabla
// en la misma base que ya usa wa-store, no una llamada al PMS.

export interface ReservaYaliDemo {
  id: string;
  sedeId: string;
  sedeNombre: string;
  habitacionId: string;
  habitacionNombre: string;
  huesped: string;
  telefono?: string;
  desde: string; // AAAA-MM-DD (entrada)
  hasta: string; // AAAA-MM-DD (salida)
  adultos: number;
  ninos: number;
  total: number;
  creada: string; // ISO 8601
  origen: "agente" | "panel";
  /**
   * Lo que hay que saber antes de que llegue: cuántos desayunos van incluidos,
   * si entra de madrugada, si pidió cama extra.
   *
   * Verónica lo pidió por su nombre en el kickoff: en Cloudbeds la nota es el
   * medio por el que reservas le avisa al hotel. "El gerente ve la nota que el
   * cliente va a llegar a las 11 y le notifica al vigilante."
   */
  notas?: string;
}

const MAX = 100;
let store: ReservaYaliDemo[] = [];

const ARCHIVO = "yali-reservas-demo.json";
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
  return `YH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export function crearReservaYali(r: Omit<ReservaYaliDemo, "id" | "creada">): ReservaYaliDemo {
  cargar();
  const reserva: ReservaYaliDemo = { ...r, id: nuevoId(), creada: new Date().toISOString() };
  store.unshift(reserva);
  if (store.length > MAX) store.length = MAX;
  guardar();
  return reserva;
}

export function listarReservasYali(): ReservaYaliDemo[] {
  cargar();
  return [...store];
}

export function borrarReservasYali(): void {
  cargado = true;
  store = [];
  guardar();
}

// ¿Ya hay una reserva del demo en esa habitación que pise alguna de estas
// noches? Dos estadías que se tocan solo en el día de salida NO se solapan: esa
// noche ya la liberó quien se va.
export function solapeYali(
  habitacionId: string,
  desde: string,
  hasta: string,
): ReservaYaliDemo | null {
  cargar();
  return (
    store.find((r) => r.habitacionId === habitacionId && r.desde < hasta && desde < r.hasta) ?? null
  );
}
