// Almacén del módulo de cobros. Vive en la memoria del proceso, igual que las
// reservas del hotel y la cartera de la inmobiliaria: es un demo, se reinicia
// solo y no ensucia nada. Cuando esto tenga que sobrevivir a un reinicio, el
// reemplazo son dos tablas en el mismo Supabase que ya usa wa-store, no un
// archivo en disco.
//
// Anclado en globalThis a propósito: en dev cada ruta compila su propia
// instancia del módulo, y un Map a nivel de módulo NO se comparte entre la ruta
// que crea la campaña y la que la hace avanzar.

import { DEUDORES_SEMILLA } from "./cobros-datos";
import { MAX_ITEMS_CAMPANA, progresoDe } from "./cobros-campanas";
import type {
  Campana,
  CampanaResumen,
  Deudor,
  Gestion,
  ItemCampana,
} from "./cobros-tipos";

interface Almacen {
  deudores: Map<string, Deudor>;
  campanas: Map<string, Campana>;
}

function sembrar(): Map<string, Deudor> {
  // Copia profunda de la semilla: el demo se puede ensuciar sin corromper el
  // módulo de datos, que es el que se vuelve a leer al reiniciar.
  return new Map(
    DEUDORES_SEMILLA.map((d) => [d.id, JSON.parse(JSON.stringify(d)) as Deudor]),
  );
}

/**
 * Una campaña YA CORRIDA, para que la pantalla no abra en blanco.
 *
 * Se arma desde la cartera semilla y no con nombres inventados aparte: cada
 * item apunta a un deudor que existe, así el usuario puede hacer clic en un
 * resultado y caer en la ficha que lo explica. Una campaña de mentira con
 * gente que no está en la cartera se nota en el primer clic.
 */
function campanaDeAyer(deudores: Map<string, Deudor>): Campana {
  const ayer = "2026-08-16";
  const MAX_INTENTOS = 3;

  // Del tramo 31 al 90, que es el corte que de verdad se llama: el de 1 a 30
  // suele pagar solo y el de mas de 90 ya va por otro camino.
  const elegidos = [...deudores.values()]
    .filter((d) => d.diasMora >= 31 && d.diasMora <= 90)
    .slice(0, 12);

  // El resultado de cada llamada se DERIVA de la ficha del deudor, no de una
  // lista inventada aparte. Asi, cuando alguien hace clic en una fila y cae en
  // la ficha, lo que lee ahi explica el resultado que acaba de ver. Un guion
  // fijo daria filas que dicen "prometio pagar" sobre cuentas sin promesa.
  function resultadoDe(d: Deudor, i: number): [ItemCampana["resultado"], number, number] {
    if (d.promesa) return ["promesa_pago", 1, 120 + (i % 5) * 9];
    if (d.estado === "pagado") return ["ya_pago", 1, 74];
    if (d.estado === "negociacion") return ["quiere_negociar", 2, 203];
    if (d.estado === "disputa") return ["disputa", 2, 245];
    if (d.estado === "no_contactar") return ["solicita_no_llamar", 1, 43];
    if (d.estado === "ilocalizable") return ["numero_equivocado", 1, 22];
    // El resto son los que no dieron nada: la mayoria de una campaña real.
    // Cierran tras agotar los tres intentos.
    const sinContacto: Array<[ItemCampana["resultado"], number, number]> = [
      ["no_contesto", MAX_INTENTOS, 0],
      ["pidio_recontacto", 2, 52],
      ["no_contesto", MAX_INTENTOS, 0],
      ["contesto_tercero", 2, 31],
      ["no_contesto", MAX_INTENTOS, 0],
      ["colgo", 2, 14],
    ];
    return sinContacto[i % sinContacto.length];
  }

  return {
    id: "camp-ayer",
    nombre: "Mora 31 a 90, corte de agosto",
    estado: "terminada",
    creada: `${ayer}T14:02:00.000Z`,
    iniciada: `${ayer}T14:02:00.000Z`,
    terminada: `${ayer}T17:38:00.000Z`,
    assistantId: "bde8ad93-9bbb-45b2-9a50-534772855458",
    phoneNumberId: "",
    concurrencia: 10,
    maxIntentos: MAX_INTENTOS,
    minutosEntreIntentos: 120,
    ventana: { horaInicio: 8, horaFin: 18, dias: [1, 2, 3, 4, 5, 6] },
    simulada: true,
    // TODOS cierran en "terminada" porque la campaña ya termino; los que no
    // contestaron lo hacen tras agotar los intentos, que es justo lo que deja
    // cerrarItem. Dejarlos en "reprogramada" pintaria una campaña terminada
    // con cola pendiente: dos cosas que no pueden ser ciertas a la vez.
    items: elegidos.map((d, i) => {
      const [resultado, intentos, duracion] = resultadoDe(d, i);
      return {
        id: `it${i}`,
        deudorId: d.id,
        nombre: d.nombre,
        telefono: d.telefono,
        estado: "terminada" as const,
        intentos,
        resultado,
        duracionSeg: duracion,
        costo: Math.round(duracion * 0.0009 * 10000) / 10000,
        actualizado: `${ayer}T${15 + (i % 3)}:${String(10 + i * 4).padStart(2, "0")}:00.000Z`,
      };
    }),
  };
}

const g = globalThis as unknown as { __cobrosAlmacen?: Almacen };
const almacen: Almacen = (g.__cobrosAlmacen ??= (() => {
  const deudores = sembrar();
  const campanas = new Map<string, Campana>();
  const ayer = campanaDeAyer(deudores);
  if (ayer.items.length > 0) campanas.set(ayer.id, ayer);
  return { deudores, campanas };
})());

const MAX_CAMPANAS = 20;
const MAX_DEUDORES = 25000;

function nuevoId(p: string): string {
  return `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ── Deudores ──

export function todosLosDeudores(): Deudor[] {
  return [...almacen.deudores.values()];
}

export function buscarDeudor(id: string): Deudor | null {
  return almacen.deudores.get(id) ?? null;
}

/** Reemplaza la ficha completa (así la actualiza la IA: copia nueva, no parche). */
export function guardarDeudor(d: Deudor): Deudor {
  almacen.deudores.set(d.id, d);
  return d;
}

export function agregarGestion(id: string, gestion: Gestion): Deudor | null {
  const d = almacen.deudores.get(id);
  if (!d) return null;
  const actualizado: Deudor = {
    ...d,
    gestiones: [gestion, ...d.gestiones].slice(0, 80),
    actualizado: gestion.cuando,
  };
  almacen.deudores.set(id, actualizado);
  return actualizado;
}

/** Alta masiva desde un archivo importado. Devuelve los deudores creados. */
export function agregarDeudores(nuevos: Deudor[]): Deudor[] {
  const creados: Deudor[] = [];
  for (const d of nuevos) {
    if (almacen.deudores.size >= MAX_DEUDORES) break;
    almacen.deudores.set(d.id, d);
    creados.push(d);
  }
  return creados;
}

/** Busca por teléfono en E.164. Lo usa el webhook de Vapi, que solo trae número. */
export function deudorPorTelefono(e164: string): Deudor | null {
  for (const d of almacen.deudores.values()) {
    if (d.telefono === e164 || d.telefonoAlterno === e164) return d;
  }
  return null;
}

// ── Campañas ──

export function todasLasCampanas(): Campana[] {
  return [...almacen.campanas.values()].sort((a, b) => b.creada.localeCompare(a.creada));
}

export function buscarCampana(id: string): Campana | null {
  return almacen.campanas.get(id) ?? null;
}

export function crearCampana(
  datos: Omit<Campana, "id" | "creada" | "items"> & { items: Omit<ItemCampana, "id">[] },
): Campana {
  const creada = new Date().toISOString();
  const campana: Campana = {
    ...datos,
    id: nuevoId("camp"),
    creada,
    items: datos.items.slice(0, MAX_ITEMS_CAMPANA).map((i, n) => ({ ...i, id: `it${n}` })),
  };
  almacen.campanas.set(campana.id, campana);

  // FIFO: el demo no guarda campañas viejas para siempre.
  while (almacen.campanas.size > MAX_CAMPANAS) {
    const primera = almacen.campanas.keys().next().value;
    if (primera === undefined) break;
    almacen.campanas.delete(primera);
  }
  return campana;
}

export function guardarCampana(c: Campana): Campana {
  almacen.campanas.set(c.id, c);
  return c;
}

/** Reemplaza un item por id. Devuelve la campaña actualizada. */
export function actualizarItem(campanaId: string, item: ItemCampana): Campana | null {
  const c = almacen.campanas.get(campanaId);
  if (!c) return null;
  const i = c.items.findIndex((x) => x.id === item.id);
  if (i < 0) return null;
  const items = [...c.items];
  items[i] = item;
  const actualizada = { ...c, items };
  almacen.campanas.set(campanaId, actualizada);
  return actualizada;
}

/** Encuentra el item (y su campaña) que disparó una llamada de Vapi. */
export function itemPorCallId(
  callId: string,
): { campana: Campana; item: ItemCampana } | null {
  for (const campana of almacen.campanas.values()) {
    const item = campana.items.find((i) => i.callId === callId);
    if (item) return { campana, item };
  }
  return null;
}

/**
 * Cuántas promesas sacó una campaña y por cuánto.
 *
 * Se lee de las FICHAS, no de los items: el item guarda cómo terminó la
 * llamada, pero el monto prometido vive en la ficha, que es donde lo dejó la
 * IA. Contarlo desde el item obligaría a duplicar el dato y a mantenerlo
 * sincronizado en dos lugares.
 */
export function promesasDeCampana(c: Campana): { cuenta: number; monto: number } {
  let cuenta = 0;
  let monto = 0;
  for (const item of c.items) {
    if (item.resultado !== "promesa_pago") continue;
    const d = almacen.deudores.get(item.deudorId);
    if (!d?.promesa) continue;
    cuenta += 1;
    monto += d.promesa.monto;
  }
  return { cuenta, monto };
}

/**
 * La campaña sin su lista de items, con el progreso ya calculado. Es lo que
 * viaja al navegador en el listado: con 10,000 filas, mandar el arreglo entero
 * es lo que tumba la pestaña.
 */
export function resumirCampana(c: Campana, promesas?: { cuenta: number; monto: number }): CampanaResumen {
  const { items: _items, ...resto } = c;
  return { ...resto, progreso: progresoDe(c, promesas) };
}

// ── Reinicio del demo ──

export function reiniciarCobros(): void {
  almacen.deudores = sembrar();
  almacen.campanas.clear();
  // Vuelve a dejar la campaña sembrada: reiniciar es volver al estado inicial,
  // no dejar la pantalla en blanco.
  const ayer = campanaDeAyer(almacen.deudores);
  if (ayer.items.length > 0) almacen.campanas.set(ayer.id, ayer);
}
