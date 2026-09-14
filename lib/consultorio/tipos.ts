// Lo que existe en el consultorio, en un solo lugar.
//
// Tres cosas y nada más: el doctor, el paciente que llegó por su QR, y lo que
// el doctor le deja escrito (una receta, una orden de exámenes, o las dos).

export interface Doctor {
  id: string;
  nombre: string;
  especialidad: string;
  /** Lo que va debajo del nombre en la receta: JVPM, registro, teléfono. */
  registro: string;
  telefono: string;
  correo: string;
  /**
   * El código que viaja en el QR. Corto y sin ambigüedad visual: es lo que
   * queda en la URL que el paciente ve al escanear, y alguien lo va a dictar
   * por teléfono alguna vez.
   */
  codigo: string;
}

export type Sexo = "F" | "M" | "otro";

export interface Paciente {
  id: string;
  doctorId: string;
  nombre: string;
  telefono: string;
  correo: string;
  /** ISO corto (YYYY-MM-DD). Se guarda la fecha, no la edad: la edad cambia. */
  nacimiento: string | null;
  sexo: Sexo | null;
  /** Lo que el propio paciente escribió al registrarse. */
  motivo: string;
  alergias: string;
  creado: string;
}

export interface Medicamento {
  nombre: string;
  dosis: string;
  frecuencia: string;
  duracion: string;
}

export interface Receta {
  id: string;
  tipo: "receta";
  pacienteId: string;
  doctorId: string;
  fecha: string;
  /**
   * El código con el que se reclama.
   *
   * Es lo que amarra al doctor con el laboratorio: el paciente llega con este
   * código, recepción lo escribe y le salen los exámenes que le dejaron, sin
   * volver a marcarlos a mano ni adivinar la letra del doctor.
   */
  codigo: string;
  medicamentos: Medicamento[];
  indicaciones: string;
  enviado: Envio | null;
}

export interface Orden {
  id: string;
  /**
   * Qué se le está mandando a hacer: exámenes de laboratorio, un estudio de
   * imágenes o un procedimiento. Comparten forma porque comparten todo lo
   * demás (de quién es, para quién, cuándo, con qué código y si ya se envió);
   * lo único que cambia es de cuál catálogo salen los ítems.
   */
  tipo: "orden" | "imagen" | "proceso";
  pacienteId: string;
  doctorId: string;
  fecha: string;
  codigo: string;
  /** Ids del catálogo de exámenes. */
  examenes: string[];
  /**
   * De qué lado va cada estudio que lo pide (los que en la orden impresa
   * llevan "Der Izq"). Solo aparecen los que lo necesitan.
   */
  lados?: Record<string, "der" | "izq" | "ambos">;
  diagnostico: string;
  indicaciones: string;
  enviado: Envio | null;
}

export type Documento = Receta | Orden;

/**
 * El envío por correo.
 *
 * `simulado` es explícito a propósito: mientras no haya proveedor conectado,
 * el sistema tiene que decir que NO salió, no dibujar un visto bueno. Un
 * "enviado" que no se envió es la clase de mentira que se descubre tarde.
 */
export interface Envio {
  a: string;
  cuando: string;
  simulado: boolean;
}

export function edad(nacimiento: string | null, hoy: Date = new Date()): number | null {
  if (!nacimiento) return null;
  const n = new Date(nacimiento);
  if (Number.isNaN(n.getTime())) return null;
  let a = hoy.getFullYear() - n.getFullYear();
  const m = hoy.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) a -= 1;
  return a >= 0 && a < 130 ? a : null;
}

/** Sin I, O, 0 ni 1: el código se dicta por teléfono y se lee de un QR borroso. */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function codigoNuevo(largo = 6): string {
  let s = "";
  for (let i = 0; i < largo; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return s;
}

export function idNuevo(prefijo: string): string {
  return `${prefijo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

// ── La sucursal donde se hacen los exámenes ─────────────────────────────────

/**
 * Qué se hace en esta unidad.
 *
 * De esto cuelga TODO lo demás: con cuál catálogo se marca, qué órdenes del
 * doctor acepta y en qué mostrador aparece la fila. Un paciente que llega con
 * una orden de laboratorio a la unidad de imagenología no tiene nada que hacer
 * ahí, y la pantalla tiene que poder decírselo.
 */
export type TipoUnidad = "laboratorio" | "imagenologia" | "procesos";

export interface Sucursal {
  id: string;
  tipo: TipoUnidad;
  nombre: string;
  direccion: string;
  horario: string;
  /** El código de SU QR, el que está pegado en la entrada. */
  codigo: string;
}

/**
 * En qué va un turno.
 *
 * "atendiendo" existe aparte de "atendido" porque son momentos distintos: es el
 * rato en que la recepción tiene el récord abierto, y es justo el rato que se
 * está midiendo.
 *
 * "pendiente" es el caso de todos los días: la persona venía por diez exámenes
 * y solo se pudo hacer seis. No está esperando, pero tampoco terminó, y lo que
 * le falta tiene que seguir a la vista.
 */
export type EstadoTurno = "esperando" | "atendiendo" | "pendiente" | "atendido";

/**
 * El código de la receta de laboratorio.
 *
 * Cinco letras, guión y seis dígitos: la forma de "ABCDE-123456", que fue el
 * ejemplo con el que nació. Se genera uno por visita porque con él se busca en
 * el mostrador ("dígame su código"), y un código igual para todos no encuentra
 * a nadie.
 *
 * Sigue siendo PROVISIONAL en una cosa: falta saber si lo trae el paciente en
 * la orden del doctor o si lo asigna el laboratorio al recibirlo. Hoy lo asigna
 * el laboratorio, acá.
 */
export function codigoReceta(): string {
  const letras = Array.from({ length: 5 }, () => ALFABETO[Math.floor(Math.random() * 24)]).join("");
  const numeros = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  return `${letras}-${numeros}`;
}

export interface Turno {
  id: string;
  sucursalId: string;
  /** El número que ve la persona. Corre por día y por sucursal. */
  numero: number;
  nombre: string;
  telefono: string;
  correo: string;
  /** Ids del catálogo: lo que pidió al registrarse. */
  examenes: string[];
  /** De esos, los que sí se le hicieron. Lo que falta es la resta. */
  hechos: string[];
  /** El de la receta de laboratorio. Hoy es el mismo para todos. */
  codigo: string;
  estado: EstadoTurno;
  creado: string;
  /**
   * Desde cuándo corre el cronómetro, o null si no está corriendo. Se guarda
   * el instante y no los segundos: así el tiempo sigue contando aunque la
   * recepcionista recargue la pantalla o la abra en otra computadora.
   */
  abierto: string | null;
  /** Segundos de atención ya acumulados, de todas las veces que se abrió. */
  segundos: number;
  /** Cuándo se le dio continuar o finalizar la última vez. */
  cerrado: string | null;
  /**
   * Lo que se le cobró, en dólares.
   *
   * Lo pone recepción sobre los exámenes que SÍ se hicieron, no lo calcula el
   * sistema: el precio real lleva convenios, descuentos y paquetes que el
   * catálogo no sabe. Sin monto no se puede finalizar.
   */
  monto: number | null;
  /** El número de factura, que se genera al finalizar. */
  factura: string | null;
}
