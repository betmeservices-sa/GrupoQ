// Prospectos de ejemplo para el tablero de ventas del demo.
//
// El embudo solo se entiende lleno: con gente en cada etapa, expedientes a
// medias, un par de casos que el vendedor no tomó a tiempo y ventas cerradas
// para que la tasa signifique algo. Se siembra UNA VEZ, cuando el cliente no
// tiene ningún caso, y desde ahí lo que se ve es lo que el equipo trabajó.
//
// Las fechas son relativas al momento de sembrar (hace 4 horas, hace 3 días),
// no fijas: así el tablero se ve vivo el día que se enseña y las alertas de 48
// y 72 horas disparan de verdad.

import { upsertContacto } from "./contacts-store";
import { vendedoresDe } from "./ventas-equipo";
import type { Expediente, Solicitud } from "./ventas-pipeline";
import { guardarSolicitud, listarSolicitudes, registrarEvento } from "./ventas-store";

const HORA = 3_600_000;

interface Caso {
  telefono: string;
  nombre: string;
  vehiculo: string;
  /** Horas atrás en que entró el lead. */
  entro: number;
  contactado?: number;
  pedidos?: number;
  expediente?: Expediente;
  completado?: number;
  vendedor?: string;
  asignado?: number;
  tomado?: number;
  cerrado?: number;
  resultado?: "venta" | "perdido";
  motivoCierre?: string;
  /** Horas atrás del último movimiento. Por defecto, lo más reciente que tenga. */
  actualizado?: number;
}

const ok = { estado: "aprobado" as const };
const recibido = { estado: "recibido" as const };

// Tres vendedores: el reparto los va rotando. Los ids son los del staff de
// Grupo Q (Ana Rivas, Mauricio Alfaro, Roberto Cáceres).
const CASOS: Caso[] = [
  // Recién entrados, nadie les ha escrito.
  { telefono: "50370020001", nombre: "Karla Menjívar", vehiculo: "Kicks", entro: 1 },
  { telefono: "50370020002", nombre: "Douglas Peña", vehiculo: "Frontier", entro: 3 },
  { telefono: "50370020003", nombre: "Ingrid Solórzano", vehiculo: "X-Trail", entro: 6 },

  // Contactados, todavía sin pedirles papeles.
  { telefono: "50370020004", nombre: "Nelson Argueta", vehiculo: "Versa", entro: 20, contactado: 19 },
  { telefono: "50370020005", nombre: "Yesenia Portillo", vehiculo: "Sentra", entro: 26, contactado: 24 },

  // Pendientes de documentación, uno por sub-estado.
  { telefono: "50370020006", nombre: "Mario Escobar", vehiculo: "Frontier", entro: 30, contactado: 29, pedidos: 28, actualizado: 28 },
  { telefono: "50370020007", nombre: "Blanca Hernández", vehiculo: "Kicks", entro: 52, contactado: 51, pedidos: 50, actualizado: 40, expediente: { dui: ok } },
  {
    telefono: "50370020008",
    nombre: "Óscar Melgar",
    vehiculo: "Navara",
    entro: 70,
    contactado: 69,
    pedidos: 68,
    actualizado: 30,
    expediente: { dui: ok, salario: ok, recibo: recibido },
  },
  {
    telefono: "50370020009",
    nombre: "Rina Castellanos",
    vehiculo: "Qashqai",
    entro: 96,
    contactado: 95,
    pedidos: 94,
    actualizado: 92,
    expediente: { dui: ok, salario: { estado: "rechazado", motivo: "monto", nota: "La constancia no muestra el salario, solo el cargo." } },
  },
  {
    telefono: "50370020010",
    nombre: "Ever Ramírez",
    vehiculo: "Urvan",
    entro: 120,
    contactado: 119,
    pedidos: 118,
    actualizado: 100,
    expediente: { dui: { estado: "rechazado", motivo: "ilegible" }, recibo: ok },
  },
  {
    telefono: "50370020011",
    nombre: "Silvia Amaya",
    vehiculo: "Sentra",
    entro: 44,
    contactado: 43,
    pedidos: 42,
    actualizado: 8,
    expediente: { dui: ok, salario: recibido, recibo: recibido, referencias: recibido },
  },
  { telefono: "50370020012", nombre: "Jorge Bonilla", vehiculo: "Patrol", entro: 18, contactado: 17, pedidos: 16, actualizado: 16 },
  {
    telefono: "50370020013",
    nombre: "Lorena Ayala",
    vehiculo: "X-Trail",
    entro: 200,
    contactado: 199,
    pedidos: 198,
    actualizado: 150,
    expediente: { dui: ok, salario: ok, referencias: ok },
  },

  // Expediente completo, todavía sin repartir (lo acaba de aprobar CrediQ).
  {
    telefono: "50370020014",
    nombre: "Fátima Rodríguez",
    vehiculo: "Kicks",
    entro: 60,
    contactado: 59,
    pedidos: 58,
    expediente: { dui: ok, salario: ok, recibo: ok, referencias: ok },
    completado: 1,
    actualizado: 1,
  },

  // Asignados: uno fresco, uno pasado de 48 h y uno vencido.
  {
    telefono: "50370020015",
    nombre: "Wilber Chávez",
    vehiculo: "Frontier",
    entro: 40,
    contactado: 39,
    pedidos: 38,
    expediente: { dui: ok, salario: ok, recibo: ok, referencias: ok },
    completado: 10,
    vendedor: "s2",
    asignado: 10,
    actualizado: 10,
  },
  {
    telefono: "50370020016",
    nombre: "Claudia Interiano",
    vehiculo: "Versa",
    entro: 90,
    contactado: 89,
    pedidos: 88,
    expediente: { dui: ok, salario: ok, recibo: ok, referencias: ok },
    completado: 55,
    vendedor: "s5",
    asignado: 55,
    actualizado: 55,
  },
  {
    telefono: "50370020017",
    nombre: "Marvin Torres",
    vehiculo: "Navara",
    entro: 140,
    contactado: 139,
    pedidos: 138,
    expediente: { dui: ok, salario: ok, recibo: ok, referencias: ok },
    completado: 82,
    vendedor: "s10",
    asignado: 82,
    actualizado: 82,
  },

  // En gestión: el vendedor ya los contactó.
  {
    telefono: "50370020018",
    nombre: "Gabriela Muñoz",
    vehiculo: "X-Trail",
    entro: 80,
    contactado: 79,
    pedidos: 78,
    expediente: { dui: ok, salario: ok, recibo: ok, referencias: ok },
    completado: 30,
    vendedor: "s2",
    asignado: 30,
    tomado: 26,
    actualizado: 26,
  },
  {
    telefono: "50370020019",
    nombre: "Rodrigo Alvarenga",
    vehiculo: "Qashqai",
    entro: 110,
    contactado: 109,
    pedidos: 108,
    expediente: { dui: ok, salario: ok, recibo: ok, referencias: ok },
    completado: 46,
    vendedor: "s5",
    asignado: 46,
    tomado: 44,
    actualizado: 44,
  },

  // Cerrados en la semana: tres ventas y una perdida.
  {
    telefono: "50370020020",
    nombre: "Ana Cristina Reyes",
    vehiculo: "Kicks",
    entro: 150,
    contactado: 149,
    pedidos: 148,
    expediente: { dui: ok, salario: ok, recibo: ok, referencias: ok },
    completado: 96,
    vendedor: "s2",
    asignado: 96,
    tomado: 92,
    cerrado: 20,
    resultado: "venta",
    actualizado: 20,
  },
  {
    telefono: "50370020021",
    nombre: "Héctor Mendoza",
    vehiculo: "Frontier",
    entro: 170,
    contactado: 169,
    pedidos: 168,
    expediente: { dui: ok, salario: ok, recibo: ok, referencias: ok },
    completado: 120,
    vendedor: "s5",
    asignado: 120,
    tomado: 118,
    cerrado: 48,
    resultado: "venta",
    actualizado: 48,
  },
  {
    telefono: "50370020022",
    nombre: "Verónica Pineda",
    vehiculo: "Sentra",
    entro: 190,
    contactado: 189,
    pedidos: 188,
    expediente: { dui: ok, salario: ok, recibo: ok, referencias: ok },
    completado: 140,
    vendedor: "s10",
    asignado: 140,
    tomado: 130,
    cerrado: 72,
    resultado: "venta",
    actualizado: 72,
  },
  {
    telefono: "50370020023",
    nombre: "Luis Alonso Guzmán",
    vehiculo: "Urvan",
    entro: 210,
    contactado: 209,
    pedidos: 208,
    expediente: { dui: ok, salario: ok, recibo: ok, referencias: ok },
    completado: 160,
    vendedor: "s2",
    asignado: 160,
    tomado: 150,
    cerrado: 60,
    resultado: "perdido",
    motivoCierre: "Se fue con la competencia por la prima",
    actualizado: 60,
  },
];

// Cuánto quiere financiar cada uno y cuántas veces se le ha buscado.
//
// Va aparte de la lista de arriba para poder leer de un vistazo cuánta plata
// hay en cada tramo del embudo. Dos casos no traen monto A PROPÓSITO: por
// teléfono no siempre lo sueltan, y el embudo tiene que aguantar eso sin
// inventarle un promedio a nadie.
//
// Los contactos son sembrados igual que el resto del demo. Con datos reales
// salen de las llamadas de Vapi y del hilo de WhatsApp, no de aquí.
const EXTRA: Record<
  string,
  {
    monto?: number;
    canal?: "whatsapp" | "instagram" | "facebook" | "organico";
    llamadas: number;
    mensajes: number;
    ultimoContacto?: number;
  }
> = {
  "50370020001": { canal: "instagram", monto: 18500, llamadas: 1, mensajes: 0, ultimoContacto: 1 },
  "50370020002": { canal: "facebook", monto: 26000, llamadas: 1, mensajes: 0, ultimoContacto: 3 },
  "50370020003": { canal: "organico", monto: 32000, llamadas: 1, mensajes: 0, ultimoContacto: 6 },
  "50370020004": { canal: "whatsapp", monto: 14500, llamadas: 2, mensajes: 1, ultimoContacto: 19 },
  "50370020005": { canal: "instagram", monto: 21000, llamadas: 2, mensajes: 3, ultimoContacto: 24 },
  "50370020006": { canal: "facebook", monto: 27500, llamadas: 3, mensajes: 2, ultimoContacto: 96 },
  "50370020007": { canal: "organico", monto: 19800, llamadas: 2, mensajes: 4, ultimoContacto: 120 },
  "50370020008": { canal: "whatsapp", monto: 35000, llamadas: 3, mensajes: 5, ultimoContacto: 120 },
  "50370020009": { canal: "instagram", monto: 12800, llamadas: 2, mensajes: 2, ultimoContacto: 200 },
  "50370020010": { canal: "facebook", monto: 23400, llamadas: 4, mensajes: 6, ultimoContacto: 190 },
  "50370020011": { canal: "organico", monto: 16900, llamadas: 2, mensajes: 1, ultimoContacto: 240 },
  "50370020012": { canal: "whatsapp", monto: 29000, llamadas: 1, mensajes: 1, ultimoContacto: 100 },
  "50370020013": { llamadas: 2, mensajes: 0, ultimoContacto: 60 },
  "50370020014": { canal: "facebook", monto: 41000, llamadas: 3, mensajes: 4, ultimoContacto: 30 },
  "50370020015": { canal: "organico", monto: 15500, llamadas: 2, mensajes: 2, ultimoContacto: 48 },
  "50370020016": { canal: "whatsapp", monto: 22000, llamadas: 3, mensajes: 3, ultimoContacto: 72 },
  "50370020017": { canal: "instagram", monto: 33500, llamadas: 4, mensajes: 7, ultimoContacto: 12 },
  "50370020018": { canal: "facebook", monto: 9800, llamadas: 1, mensajes: 2, ultimoContacto: 36 },
  "50370020019": { canal: "organico", monto: 28700, llamadas: 3, mensajes: 5, ultimoContacto: 18 },
  "50370020020": { canal: "whatsapp", monto: 17200, llamadas: 2, mensajes: 3, ultimoContacto: 8 },
  "50370020021": { canal: "instagram", monto: 24900, llamadas: 3, mensajes: 6, ultimoContacto: 5 },
  "50370020022": { llamadas: 1, mensajes: 0, ultimoContacto: 15 },
  "50370020023": { canal: "organico", monto: 31000, llamadas: 4, mensajes: 8, ultimoContacto: 2 },
};

function aSolicitud(tenant: string, c: Caso, ahora: number, vendedorPorDefecto?: string): Solicitud {
  const hace = (h?: number) => (h === undefined ? null : new Date(ahora - h * HORA).toISOString());
  const ultimo = c.actualizado ?? c.cerrado ?? c.tomado ?? c.asignado ?? c.completado ?? c.pedidos ?? c.contactado ?? c.entro;
  return {
    tenant,
    telefono: c.telefono,
    nombre: c.nombre,
    vehiculo: c.vehiculo,
    monto: EXTRA[c.telefono]?.monto ?? null,
    canal: EXTRA[c.telefono]?.canal ?? null,
    contactos: {
      llamadas: EXTRA[c.telefono]?.llamadas ?? 0,
      mensajes: EXTRA[c.telefono]?.mensajes ?? 0,
      ultimo: hace(EXTRA[c.telefono]?.ultimoContacto ?? ultimo),
    },
    expediente: c.expediente ?? {},
    // Todo lead entra con vendedor: en el embudo nuevo la primera etapa es
    // "asignadas", asi que uno sin dueno seria un caso roto, no uno temprano.
    vendedor: c.vendedor ?? vendedorPorDefecto ?? null,
    creado: hace(c.entro) as string,
    contactado: hace(c.contactado),
    pedidos: hace(c.pedidos),
    completado: hace(c.completado),
    asignado: hace(c.asignado),
    tomado: hace(c.tomado),
    cerrado: hace(c.cerrado),
    resultado: c.resultado ?? null,
    motivoCierre: c.motivoCierre ?? null,
    avisado: null,
    escalado: null,
    actualizado: hace(ultimo) as string,
  };
}

/**
 * Llena el tablero la primera vez. Devuelve cuántos casos sembró; 0 si el
 * cliente ya tenía los suyos (nunca pisa datos reales).
 */
/**
 * Rellena lo que le falta a las fichas ya sembradas.
 *
 * POR QUE EXISTE. El sembrador solo corre con la tabla vacia, asi que una
 * columna nueva nunca llega a las fichas que ya estaban: se agrego `monto`, se
 * agrego `canal`, y en el demo desplegado los dos salian en nulo. El embudo
 * mostraba cero plata y las barras salian todas grises, con el codigo correcto.
 *
 * Toca SOLO los telefonos del demo y SOLO los campos en nulo: si alguien marco
 * un canal a mano en la pantalla, ese gana. Es idempotente, corre en cada carga
 * del tablero y no cuesta nada cuando no hay nada que rellenar.
 */
/** Cada cuánto se vuelve a poner al día el demo. */
const FRESCURA = 20 * HORA;

/** Corre una fecha ISO hacia adelante, o la deja nula si lo era. */
function correr(iso: string | null | undefined, delta: number): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t + delta).toISOString();
}

/**
 * Le suma `delta` a TODAS las fechas de una ficha, incluidas las de cada
 * documento del expediente.
 *
 * Se mueve todo por igual: las distancias entre fechas son lo que hace que las
 * alertas de 48 y 72 horas signifiquen algo, y si se movieran distinto el
 * tablero mostraría alertas que no corresponden.
 */
function correrFechas(s: Solicitud, delta: number): Solicitud {
  const expediente: Solicitud["expediente"] = {};
  for (const [id, d] of Object.entries(s.expediente ?? {})) {
    expediente[id] = d.ts ? { ...d, ts: correr(d.ts, delta) } : d;
  }
  return {
    ...s,
    expediente,
    creado: correr(s.creado, delta) ?? s.creado,
    contactado: correr(s.contactado, delta),
    pedidos: correr(s.pedidos, delta),
    completado: correr(s.completado, delta),
    asignado: correr(s.asignado, delta),
    tomado: correr(s.tomado, delta),
    cerrado: correr(s.cerrado, delta),
    avisado: correr(s.avisado, delta),
    escalado: correr(s.escalado, delta),
    actualizado: correr(s.actualizado, delta) ?? s.actualizado,
    contactos: s.contactos ? { ...s.contactos, ultimo: correr(s.contactos.ultimo, delta) } : s.contactos,
  };
}

/**
 * Rellena y pone al día las fichas ya sembradas.
 *
 * DOS COSAS SE PUDREN CON EL TIEMPO, y las dos se vieron en el demo desplegado:
 *
 * 1. LAS COLUMNAS NUEVAS. El sembrador solo corre con la tabla vacía, así que
 *    una columna agregada después nunca llega a las fichas que ya estaban. Pasó
 *    con `monto`, con `canal` y con `vendedor`: 14 de 23 fichas sin dueño, el
 *    embudo en $0 y las barras todas grises, con el código correcto.
 *
 * 2. LAS FECHAS. Se siembran relativas al momento de sembrar ("hace 10 horas")
 *    justamente para que el tablero se vea vivo el día que se enseña. Pero como
 *    se siembra UNA sola vez, al día siguiente ya son de ayer, y a la semana la
 *    gráfica de "leads asignados" sale vacía porque su ventana es de 7 días.
 *    Acá se corren TODAS las fechas del demo el mismo tanto, así que el tablero
 *    amanece al día sin perder ni el orden ni las distancias entre eventos.
 *
 * Solo toca los teléfonos del demo. Un lead de una persona real no se mueve ni
 * se rellena nunca.
 */
async function completarSembrado(existentes: Solicitud[], equipo: string[]): Promise<number> {
  const delDemo = existentes.filter((s) => EXTRA[s.telefono]);
  if (delDemo.length === 0) return 0;

  // La referencia es `creado`: es la única fecha que nadie mueve desde la
  // pantalla, así que dice de verdad qué tan viejo está el demo. Si se usara
  // `actualizado`, bastaría con que alguien tocara UNA ficha para que el resto
  // se quedara viejo.
  const masNuevo = Math.max(...delDemo.map((s) => Date.parse(s.creado) || 0));
  const atraso = Date.now() - masNuevo;
  const delta = atraso > FRESCURA ? atraso : 0;

  let tocadas = 0;
  for (const [i, s] of delDemo.entries()) {
    const extra = EXTRA[s.telefono]!;
    const monto = s.monto ?? extra.monto ?? null;
    const canal = s.canal ?? extra.canal ?? null;
    // Sin dueño no hay barra: la primera etapa del embudo es "asignadas".
    const vendedor = s.vendedor ?? equipo[i % Math.max(1, equipo.length)] ?? null;
    const igual =
      delta === 0 &&
      monto === (s.monto ?? null) &&
      canal === (s.canal ?? null) &&
      vendedor === (s.vendedor ?? null);
    if (igual) continue;

    let siguiente: Solicitud = { ...s, monto, canal, vendedor };
    // Un lead con dueño y sin fecha de asignación no aparece en ninguna
    // ventana de tiempo: se le pone la de su último movimiento.
    if (vendedor && !siguiente.asignado) siguiente.asignado = siguiente.actualizado ?? siguiente.creado;
    if (delta > 0) siguiente = correrFechas(siguiente, delta);
    await guardarSolicitud(siguiente);
    tocadas++;
  }
  return tocadas;
}

export async function sembrarVentasSiVacio(tenant: string): Promise<number> {
  if (vendedoresDe(tenant).length === 0) return 0;
  const existentes = await listarSolicitudes(tenant);
  if (existentes.length > 0) {
    await completarSembrado(existentes, vendedoresDe(tenant).map((v) => v.id));
    return 0;
  }
  const ahora = Date.now();
  const equipo = vendedoresDe(tenant);
  for (const [i, c] of CASOS.entries()) {
    // Reparto parejo, como lo haria el motor: uno para cada quien, en orden.
    const s = aSolicitud(tenant, c, ahora, equipo[i % equipo.length]?.id);
    await guardarSolicitud(s);
    await upsertContacto({
      from: c.telefono,
      nombre: c.nombre.split(" ")[0],
      apellido: c.nombre.split(" ").slice(1).join(" "),
      notas: `Interesado en ${c.vehiculo}`,
      tenant,
    });
    await registrarEvento(tenant, c.telefono, "creado", "sistema", "sembrado");
  }
  return CASOS.length;
}
