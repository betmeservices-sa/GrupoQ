// Dónde vive lo del consultorio.
//
// Supabase cuando hay tablas, y memoria del proceso cuando no. La distinción
// importa acá más que en otros módulos: lo que este demo enseña es que el
// paciente se registra en su teléfono y aparece en la pantalla del doctor, y en
// Vercel esas dos peticiones pueden caer en instancias distintas. Con memoria,
// el paciente escanea y del otro lado no aparece nadie.
//
// Por eso el aviso de abajo se imprime UNA vez: si el esquema no está expuesto
// o falta la tabla, PostgREST devuelve cero filas SIN error, y sin ese latch la
// caída a memoria pasa desapercibida hasta que se enseña el demo.
//
// Los doctores y las sucursales viven en código: son la escenografía del demo,
// no cambian, y tenerlos acá evita dos tablas que nadie edita.

import { getSupabase } from "@/lib/supabase";
import {
  idNuevo,
  codigoReceta,
  type Doctor,
  type Documento,
  type Paciente,
  type Sucursal,
  type Turno,
} from "./tipos";

// ── La escenografía: dos doctores y dos sucursales ──────────────────────────

const DOCTORES: Doctor[] = [
  {
    id: "dr_moran",
    nombre: "Dra. Alejandra Morán",
    especialidad: "Medicina interna",
    registro: "JVPM 12458",
    telefono: "+503 2245 8890",
    correo: "alejandra.moran@sanbenito.com",
    codigo: "AM4K2P",
  },
  {
    id: "dr_rivas",
    nombre: "Dr. Ernesto Rivas",
    especialidad: "Cardiología",
    registro: "JVPM 10932",
    telefono: "+503 2245 8891",
    correo: "ernesto.rivas@sanbenito.com",
    codigo: "ER7T9M",
  },
];

const SUCURSALES: Sucursal[] = [
  {
    id: "suc_escalon",
    tipo: "laboratorio",
    nombre: "Laboratorio Escalón",
    direccion: "Paseo General Escalón, frente al parque Beethoven",
    horario: "Lunes a viernes de 6:30 a. m. a 5:00 p. m. · Sábados hasta mediodía",
    codigo: "LAB4ES",
  },
  {
    id: "suc_santa_tecla",
    tipo: "laboratorio",
    nombre: "Laboratorio Santa Tecla",
    direccion: "Avenida Manuel Gallardo, contiguo a la clínica municipal",
    horario: "Lunes a sábado de 7:00 a. m. a 4:00 p. m.",
    codigo: "LAB9ST",
  },
  {
    id: "uni_imagenes",
    tipo: "imagenologia",
    nombre: "Unidad de Imagenología",
    direccion: "Paseo General Escalón, segundo nivel de la clínica",
    horario: "Lunes a viernes de 7:00 a. m. a 7:00 p. m. · Sábados de 8:00 a. m. a 1:00 p. m.",
    codigo: "IMG7RX",
  },
  {
    id: "uni_procesos",
    tipo: "procesos",
    nombre: "Sala de procedimientos",
    direccion: "Paseo General Escalón, primer nivel, pasillo B",
    horario: "Lunes a viernes de 7:00 a. m. a 5:00 p. m.",
    codigo: "PRC5CG",
  },
];

export function listarDoctores(): Doctor[] {
  return DOCTORES;
}

export function doctorPorId(id: string): Doctor | null {
  return DOCTORES.find((d) => d.id === id) ?? null;
}

/** El que está detrás de un QR. Es la única forma de entrar sin sesión. */
export function doctorPorCodigo(codigo: string): Doctor | null {
  const c = codigo.trim().toUpperCase();
  return DOCTORES.find((d) => d.codigo === c) ?? null;
}

export function listarSucursales(tipo?: Sucursal["tipo"]): Sucursal[] {
  return tipo ? SUCURSALES.filter((s) => s.tipo === tipo) : SUCURSALES;
}

/** Con cuál catálogo se marca en esta unidad. */
export function tipoDeOrdenDe(tipo: Sucursal["tipo"]): "orden" | "imagen" | "proceso" {
  return tipo === "imagenologia" ? "imagen" : tipo === "procesos" ? "proceso" : "orden";
}

export function sucursalPorId(id: string): Sucursal | null {
  return SUCURSALES.find((s) => s.id === id) ?? null;
}

/** La que está detrás del QR de la entrada. */
export function sucursalPorCodigo(codigo: string): Sucursal | null {
  const c = codigo.trim().toUpperCase();
  return SUCURSALES.find((s) => s.codigo === c) ?? null;
}

// ── El respaldo en memoria ──────────────────────────────────────────────────

interface Memoria {
  pacientes: Paciente[];
  documentos: Documento[];
  turnos: Turno[];
}

const g = globalThis as unknown as { __consultorio?: Memoria; __consultorioAviso?: boolean };

function mem(): Memoria {
  if (!g.__consultorio) g.__consultorio = { pacientes: [], documentos: [], turnos: [] };
  return g.__consultorio;
}

function sinTablas(donde: string, detalle?: unknown): null {
  if (!g.__consultorioAviso) {
    g.__consultorioAviso = true;
    console.warn(
      `[consultorio] cayendo a memoria (${donde}). En Vercel esto significa que el paciente que escanea NO le aparece al doctor. Falta correr supabase/consultorio.sql.`,
      detalle ?? "",
    );
  }
  return null;
}

/** El cliente, o null si no hay Supabase configurado. */
function db() {
  return getSupabase();
}

// ── Pacientes ───────────────────────────────────────────────────────────────

const dePaciente = (f: Record<string, unknown>): Paciente => ({
  id: String(f.id),
  doctorId: String(f.doctor_id),
  nombre: String(f.nombre),
  telefono: String(f.telefono ?? ""),
  correo: String(f.correo ?? ""),
  nacimiento: (f.nacimiento as string | null) ?? null,
  sexo: (f.sexo as Paciente["sexo"]) ?? null,
  motivo: String(f.motivo ?? ""),
  alergias: String(f.alergias ?? ""),
  creado: String(f.creado),
});

const aPaciente = (p: Paciente) => ({
  id: p.id,
  doctor_id: p.doctorId,
  nombre: p.nombre,
  telefono: p.telefono,
  correo: p.correo,
  nacimiento: p.nacimiento,
  sexo: p.sexo,
  motivo: p.motivo,
  alergias: p.alergias,
  creado: p.creado,
});

export async function pacientesDe(doctorId: string): Promise<Paciente[]> {
  const sb = db();
  if (sb) {
    const { data, error } = await sb
      .from("consultorio_pacientes")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("creado", { ascending: false });
    if (!error && data) return data.map(dePaciente);
    sinTablas("pacientesDe", error?.message);
  }
  return mem()
    .pacientes.filter((p) => p.doctorId === doctorId)
    .sort((a, b) => b.creado.localeCompare(a.creado));
}

export async function pacientePorId(id: string): Promise<Paciente | null> {
  const sb = db();
  if (sb) {
    const { data, error } = await sb
      .from("consultorio_pacientes")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!error) return data ? dePaciente(data) : null;
    sinTablas("pacientePorId", error?.message);
  }
  return mem().pacientes.find((p) => p.id === id) ?? null;
}

export async function registrarPaciente(
  datos: Omit<Paciente, "id" | "creado">,
): Promise<{ paciente: Paciente; repetido: boolean }> {
  // Si el mismo teléfono ya se registró con ese doctor, se actualiza en vez de
  // duplicar: la gente vuelve a escanear el QR en la siguiente consulta y no
  // tiene por qué convertirse en dos expedientes.
  const sb = db();
  if (sb) {
    const { data: previo } = await sb
      .from("consultorio_pacientes")
      .select("*")
      .eq("doctor_id", datos.doctorId)
      .eq("telefono", datos.telefono)
      .maybeSingle();
    if (previo) {
      const actualizado: Paciente = { ...dePaciente(previo), ...datos };
      const { error } = await sb
        .from("consultorio_pacientes")
        .update(aPaciente(actualizado))
        .eq("id", actualizado.id);
      if (!error) return { paciente: actualizado, repetido: true };
      sinTablas("registrarPaciente(update)", error.message);
    } else {
      const paciente: Paciente = { ...datos, id: idNuevo("pac"), creado: new Date().toISOString() };
      const { error } = await sb.from("consultorio_pacientes").insert(aPaciente(paciente));
      if (!error) return { paciente, repetido: false };
      sinTablas("registrarPaciente(insert)", error.message);
    }
  }

  const previo = mem().pacientes.find(
    (p) => p.doctorId === datos.doctorId && p.telefono === datos.telefono,
  );
  if (previo) {
    Object.assign(previo, datos, { creado: previo.creado });
    return { paciente: previo, repetido: true };
  }
  const paciente: Paciente = { ...datos, id: idNuevo("pac"), creado: new Date().toISOString() };
  mem().pacientes.push(paciente);
  return { paciente, repetido: false };
}

// ── Recetas y órdenes ───────────────────────────────────────────────────────
//
// Los dos tipos de documento comparten tabla: lo que cambia entre una receta y
// una orden va en `datos`, que es jsonb. Separarlos en dos tablas obligaría a
// consultar las dos cada vez que se pregunta "qué le dejaron a este paciente",
// que es la única pregunta que se hace.

const deDocumento = (f: Record<string, unknown>): Documento =>
  ({
    id: String(f.id),
    tipo: f.tipo as Documento["tipo"],
    pacienteId: String(f.paciente_id),
    doctorId: String(f.doctor_id),
    fecha: String(f.fecha),
    codigo: String(f.codigo ?? ""),
    enviado: (f.enviado as Documento["enviado"]) ?? null,
    ...(f.datos as object),
  }) as Documento;

const aDocumento = (d: Documento) => {
  const { id, tipo, pacienteId, doctorId, fecha, codigo, enviado, ...resto } = d;
  return {
    id,
    tipo,
    paciente_id: pacienteId,
    doctor_id: doctorId,
    fecha,
    codigo,
    enviado,
    datos: resto,
  };
};

/**
 * El documento de un código.
 *
 * Es la puerta por la que el laboratorio recibe lo que mandó el doctor, y por
 * eso NO filtra por doctor: el código lo trae el paciente y vale en cualquier
 * mostrador. Lo que sí hace es no devolver recetas: lo que se reclama con un
 * código en el laboratorio son exámenes, imágenes o procedimientos.
 */
export async function documentoPorCodigo(codigo: string): Promise<Documento | null> {
  const c = codigo.trim().toUpperCase().replace(/\s+/g, "");
  if (!/^[A-Z]{5}-\d{6}$/.test(c)) return null;
  const sb = db();
  if (sb) {
    const { data, error } = await sb
      .from("consultorio_documentos")
      .select("*")
      .eq("codigo", c)
      .maybeSingle();
    if (!error) {
      const doc = data ? deDocumento(data) : null;
      return doc && doc.tipo !== "receta" ? doc : null;
    }
    sinTablas("documentoPorCodigo", error?.message);
  }
  const doc = mem().documentos.find((d) => d.codigo?.toUpperCase() === c) ?? null;
  return doc && doc.tipo !== "receta" ? doc : null;
}

export async function documentosDe(pacienteId: string): Promise<Documento[]> {
  const sb = db();
  if (sb) {
    const { data, error } = await sb
      .from("consultorio_documentos")
      .select("*")
      .eq("paciente_id", pacienteId)
      .order("fecha", { ascending: false });
    if (!error && data) return data.map(deDocumento);
    sinTablas("documentosDe", error?.message);
  }
  return mem()
    .documentos.filter((d) => d.pacienteId === pacienteId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Todo lo que el doctor ha dejado escrito, sin importar a quién. */
export async function documentosDeDoctor(doctorId: string): Promise<Documento[]> {
  const sb = db();
  if (sb) {
    const { data, error } = await sb
      .from("consultorio_documentos")
      .select("*")
      .eq("doctor_id", doctorId)
      .order("fecha", { ascending: false });
    if (!error && data) return data.map(deDocumento);
    sinTablas("documentosDeDoctor", error?.message);
  }
  return mem()
    .documentos.filter((d) => d.doctorId === doctorId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export async function documentoPorId(id: string): Promise<Documento | null> {
  const sb = db();
  if (sb) {
    const { data, error } = await sb
      .from("consultorio_documentos")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!error) return data ? deDocumento(data) : null;
    sinTablas("documentoPorId", error?.message);
  }
  return mem().documentos.find((d) => d.id === id) ?? null;
}

export async function guardarDocumento(doc: Documento): Promise<Documento> {
  const sb = db();
  if (sb) {
    const { error } = await sb.from("consultorio_documentos").upsert(aDocumento(doc));
    if (!error) return doc;
    sinTablas("guardarDocumento", error.message);
  }
  const i = mem().documentos.findIndex((d) => d.id === doc.id);
  if (i >= 0) mem().documentos[i] = doc;
  else mem().documentos.push(doc);
  return doc;
}

// ── La fila del laboratorio ─────────────────────────────────────────────────

const deTurno = (f: Record<string, unknown>): Turno => ({
  id: String(f.id),
  sucursalId: String(f.sucursal_id),
  numero: Number(f.numero),
  nombre: String(f.nombre),
  telefono: String(f.telefono ?? ""),
  correo: String(f.correo ?? ""),
  examenes: (f.examenes as string[]) ?? [],
  hechos: (f.hechos as string[]) ?? [],
  codigo: String(f.codigo ?? ""),
  estado: f.estado as Turno["estado"],
  creado: String(f.creado),
  abierto: (f.abierto as string | null) ?? null,
  segundos: Number(f.segundos ?? 0),
  cerrado: (f.cerrado as string | null) ?? null,
  monto: f.monto === null || f.monto === undefined ? null : Number(f.monto),
  factura: (f.factura as string | null) ?? null,
});

const aTurno = (t: Turno) => ({
  id: t.id,
  sucursal_id: t.sucursalId,
  numero: t.numero,
  nombre: t.nombre,
  telefono: t.telefono,
  correo: t.correo,
  examenes: t.examenes,
  hechos: t.hechos,
  codigo: t.codigo,
  estado: t.estado,
  creado: t.creado,
  abierto: t.abierto,
  segundos: t.segundos,
  cerrado: t.cerrado,
  monto: t.monto,
  factura: t.factura,
});

// "Hoy" es el día de El Salvador, no el del servidor. En Vercel el proceso
// corre en UTC, y con el día de UTC la fila del laboratorio se vaciaba sola a
// las 6 de la tarde hora local: alguien tomaba turno a las 5:50 y quince
// minutos después el mostrador ya no lo veía.
const DIA_SV = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/El_Salvador",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const esDeHoy = (iso: string) => DIA_SV.format(new Date(iso)) === DIA_SV.format(new Date());

/** La fila de hoy. Los turnos de ayer no le estorban a nadie. */
export async function turnosDe(sucursalId: string): Promise<Turno[]> {
  const sb = db();
  if (sb) {
    // El corte del día se hace acá y no en SQL a propósito: "hoy" es el día de
    // El Salvador y la base guarda en UTC, así que a las 6 de la tarde un
    // `date(creado) = current_date` ya cambió de día y borraría la fila viva.
    const desde = new Date(Date.now() - 36 * 3600_000).toISOString();
    const { data, error } = await sb
      .from("consultorio_turnos")
      .select("*")
      .eq("sucursal_id", sucursalId)
      .gte("creado", desde)
      .order("numero", { ascending: true });
    if (!error && data) return data.map(deTurno).filter((t) => esDeHoy(t.creado));
    sinTablas("turnosDe", error?.message);
  }
  return mem()
    .turnos.filter((t) => t.sucursalId === sucursalId && esDeHoy(t.creado))
    .sort((a, b) => a.numero - b.numero);
}

export async function turnoPorId(id: string): Promise<Turno | null> {
  const sb = db();
  if (sb) {
    const { data, error } = await sb
      .from("consultorio_turnos")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (!error) return data ? deTurno(data) : null;
    sinTablas("turnoPorId", error?.message);
  }
  return mem().turnos.find((t) => t.id === id) ?? null;
}

export async function crearTurno(
  datos: Pick<Turno, "sucursalId" | "nombre" | "telefono" | "correo" | "examenes">,
): Promise<Turno> {
  // El número corre por día y por sucursal: empezar en 1 cada mañana es lo que
  // la gente espera de una fila, y un correlativo eterno ("turno 4.812") no le
  // dice nada a nadie.
  const hoy = await turnosDe(datos.sucursalId);
  const turno: Turno = {
    ...datos,
    id: idNuevo("trn"),
    numero: (hoy.at(-1)?.numero ?? 0) + 1,
    hechos: [],
    codigo: codigoReceta(),
    estado: "esperando",
    creado: new Date().toISOString(),
    abierto: null,
    segundos: 0,
    cerrado: null,
    monto: null,
    factura: null,
  };
  const sb = db();
  if (sb) {
    const { error } = await sb.from("consultorio_turnos").insert(aTurno(turno));
    if (!error) return turno;
    sinTablas("crearTurno", error.message);
  }
  mem().turnos.push(turno);
  return turno;
}

/**
 * Cuántos hay delante.
 *
 * Cuenta solo a los que siguen esperando: los ya atendidos no le quitan el
 * lugar a nadie, y el que está adentro tampoco. 0 = te toca.
 */
/**
 * El turno de un código, dentro de la sucursal que pregunta.
 *
 * Se busca en la fila del día y no en toda la tabla a propósito: el código de
 * ayer no abre el récord de hoy, y el de la otra sucursal tampoco.
 */
export async function turnoPorCodigo(sucursalId: string, codigo: string): Promise<Turno | null> {
  const c = codigo.trim().toUpperCase().replace(/s+/g, "");
  const fila = await turnosDe(sucursalId);
  return fila.find((t) => t.codigo.toUpperCase() === c) ?? null;
}

export async function cuantosDelante(turno: Turno): Promise<number> {
  const fila = await turnosDe(turno.sucursalId);
  return fila.filter((t) => t.estado === "esperando" && t.numero < turno.numero).length;
}

const segundosDesde = (iso: string) => Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));

async function guardarTurno(t: Turno): Promise<Turno> {
  const sb = db();
  if (sb) {
    const { error } = await sb.from("consultorio_turnos").update(aTurno(t)).eq("id", t.id);
    if (!error) return t;
    sinTablas("guardarTurno", error.message);
  }
  const i = mem().turnos.findIndex((x) => x.id === t.id);
  if (i >= 0) mem().turnos[i] = t;
  return t;
}

/**
 * La recepción abre el récord de alguien: ahí arranca el cronómetro.
 *
 * Solo puede haber un récord abierto por sucursal. Si había otro, se le para el
 * reloj y vuelve a la fila: la recepcionista se cambió de persona, y contarle
 * a la primera el tiempo que pasó atendiendo a la segunda sería medir mentiras.
 */
export async function abrirTurno(turnoId: string): Promise<Turno | null> {
  const t = await turnoPorId(turnoId);
  if (!t) return null;

  const fila = await turnosDe(t.sucursalId);
  const previo = fila.find((x) => x.estado === "atendiendo" && x.id !== t.id);
  if (previo) {
    previo.segundos += previo.abierto ? segundosDesde(previo.abierto) : 0;
    previo.abierto = null;
    previo.estado = previo.hechos.length > 0 ? "pendiente" : "esperando";
    await guardarTurno(previo);
  }

  if (t.estado === "atendiendo") return t;
  t.estado = "atendiendo";
  t.abierto = new Date().toISOString();
  return guardarTurno(t);
}

/** El correlativo del día, por sucursal: es como se cuadra con caja. */
async function facturaNueva(sucursalId: string, sigla: string): Promise<string> {
  const fila = await turnosDe(sucursalId);
  const dadas = fila.filter((t) => t.factura).length;
  const dia = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/El_Salvador",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .replace(/-/g, "");
  return `${sigla}-${dia}-${String(dadas + 1).padStart(3, "0")}`;
}

/**
 * Continuar o finalizar: en las dos se para el cronómetro y se guarda lo que sí
 * se le hizo y lo que se le cobró. La diferencia es si la visita queda abierta.
 *
 * Al finalizar se emite la factura, y solo ahí: mientras la persona siga
 * debiendo exámenes no se le cierra la cuenta, porque lo que falta también se
 * cobra. Por eso el número se genera acá y no en la pantalla, y una visita
 * finalizada conserva el suyo aunque se vuelva a abrir.
 */
export async function cerrarTurno(
  turnoId: string,
  hechos: string[],
  final: boolean,
  monto: number | null,
): Promise<Turno | null> {
  const t = await turnoPorId(turnoId);
  if (!t) return null;
  // Solo puede marcarse como hecho lo que la persona pidió: si se cuela otro
  // id, el récord diría que se hizo un examen que nadie ordenó.
  t.hechos = t.examenes.filter((e) => hechos.includes(e));
  t.segundos += t.abierto ? segundosDesde(t.abierto) : 0;
  t.abierto = null;
  t.cerrado = new Date().toISOString();
  t.estado = final ? "atendido" : "pendiente";
  if (monto !== null && Number.isFinite(monto)) t.monto = Math.round(monto * 100) / 100;
  if (final && !t.factura) {
    const sigla = t.sucursalId === "suc_santa_tecla" ? "ST" : "ES";
    t.factura = await facturaNueva(t.sucursalId, sigla);
  }
  return guardarTurno(t);
}
