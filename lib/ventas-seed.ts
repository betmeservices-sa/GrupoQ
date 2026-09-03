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

function aSolicitud(tenant: string, c: Caso, ahora: number): Solicitud {
  const hace = (h?: number) => (h === undefined ? null : new Date(ahora - h * HORA).toISOString());
  const ultimo = c.actualizado ?? c.cerrado ?? c.tomado ?? c.asignado ?? c.completado ?? c.pedidos ?? c.contactado ?? c.entro;
  return {
    tenant,
    telefono: c.telefono,
    nombre: c.nombre,
    vehiculo: c.vehiculo,
    expediente: c.expediente ?? {},
    vendedor: c.vendedor ?? null,
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
export async function sembrarVentasSiVacio(tenant: string): Promise<number> {
  if (vendedoresDe(tenant).length === 0) return 0;
  const existentes = await listarSolicitudes(tenant);
  if (existentes.length > 0) return 0;
  const ahora = Date.now();
  for (const c of CASOS) {
    const s = aSolicitud(tenant, c, ahora);
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
