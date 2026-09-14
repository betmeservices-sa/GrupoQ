// Lo que se le manda al paciente por correo.
//
// El envío lo hace n8n: la app arma el contenido y se lo entrega ya escrito, en
// texto plano, al webhook. Es a propósito. Si la app mandara solo los datos
// sueltos, el flujo de n8n tendría que saber redactar una receta, y el día que
// cambie el formato habría que tocarlo allá. Así, n8n hace una sola cosa (poner
// eso en un correo y enviarlo) y el contenido vive con el resto del módulo.
//
// Nunca se manda "enviado" si no salió: la respuesta dice `simulado: true` y la
// pantalla lo repite con todas sus letras. Un visto bueno falso se descubre
// cuando el paciente llega a la farmacia sin la receta.

import { NOMBRE_TIPO, agruparDe, conLado } from "./catalogos";
import { armarHtml } from "./correo-html";
import type { Doctor, Documento, Paciente } from "./tipos";

export const CLINICA = "Centro Médico San Benito";

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-SV", { day: "numeric", month: "long", year: "numeric" });

export interface CorreoDeDocumento {
  a: string;
  asunto: string;
  /** El correo ya armado: n8n lo manda tal cual. */
  html: string;
  /** El mismo contenido en texto plano, para quien no pinta HTML. */
  texto: string;
  clinica: string;
  codigo: string;
  tipo: Documento["tipo"];
  fecha: string;
  paciente: { nombre: string; telefono: string };
  doctor: { nombre: string; especialidad: string; registro: string; telefono: string };
}

/** El correo listo para enviar: asunto, cuerpo y los datos por si se necesitan. */
export function armarCorreo(
  doc: Documento,
  paciente: Paciente,
  doctor: Doctor,
): CorreoDeDocumento {
  const titulo = doc.tipo === "receta" ? "Receta médica" : NOMBRE_TIPO[doc.tipo];

  const cuerpo =
    doc.tipo === "receta"
      ? doc.medicamentos
          .map(
            (m, i) =>
              `${i + 1}. ${m.nombre}` +
              [m.dosis, m.frecuencia, m.duracion].filter(Boolean).map((x) => `\n   ${x}`).join(""),
          )
          .join("\n")
      : // Agrupado por área, como en la hoja impresa: un renglón que dice
        // "Tiroides" no aclara si es el ultrasonido o la prueba de sangre.
        agruparDe(doc.tipo, doc.examenes)
          .map(
            (g) =>
              `${g.area.toUpperCase()}\n` +
              g.examenes
                .map((e) => {
                  const nota = e.nota ? `\n   ${e.nota}` : "";
                  return `- ${conLado(e.id, doc.lados)}${e.codigo ? ` (${e.codigo})` : ""}${nota}`;
                })
                .join("\n"),
          )
          .join("\n\n");

  const lineas = [
    `${CLINICA}`,
    `${titulo}`,
    "",
    `Paciente: ${paciente.nombre}`,
    `Fecha: ${fecha(doc.fecha)}`,
    `Código: ${doc.codigo}`,
    "",
    cuerpo,
    doc.tipo !== "receta" && doc.diagnostico ? `\nDatos clínicos: ${doc.diagnostico}` : "",
    doc.indicaciones ? `\nIndicaciones:\n${doc.indicaciones}` : "",
    doc.tipo !== "receta"
      ? `\nPresente este código en la recepción y le marcamos todo sin llenar nada: ${doc.codigo}`
      : "",
    "",
    `${doctor.nombre}`,
    `${doctor.especialidad} · ${doctor.registro}`,
    `${doctor.telefono}`,
  ];

  return {
    a: paciente.correo,
    asunto: `${titulo} de ${CLINICA} · ${doc.codigo}`,
    html: armarHtml(doc, paciente, doctor, CLINICA),
    texto: lineas.filter((l) => l !== "").join("\n"),
    clinica: CLINICA,
    codigo: doc.codigo,
    tipo: doc.tipo,
    fecha: doc.fecha,
    paciente: { nombre: paciente.nombre, telefono: paciente.telefono },
    doctor: {
      nombre: doctor.nombre,
      especialidad: doctor.especialidad,
      registro: doctor.registro,
      telefono: doctor.telefono,
    },
  };
}

/**
 * Se lo entrega a n8n.
 *
 * La URL sale de N8N_CORREO_URL (o de <N8N_WEBHOOK_BASE>/consultorio-correo).
 * El flujo del otro lado solo tiene que tomar `a`, `asunto`, `html` y `texto`
 * y enviarlos: el correo va armado desde acá (ver n8n/consultorio-correo.json).
 * Si no hay URL configurada o n8n contesta mal, devuelve false y el módulo dice
 * que el correo NO salió.
 */
export async function mandarPorN8n(
  correo: CorreoDeDocumento,
): Promise<{ salio: boolean; porque?: string }> {
  // Variable propia y no la base de los webhooks de citas: esa la comparten
  // todos los clientes del demo, y encenderla acá le prendería el agendamiento
  // por n8n a tenants que hoy no lo usan. Esto tiene que mover una sola cosa.
  const url =
    process.env.N8N_CORREO_URL ??
    (process.env.N8N_WEBHOOK_BASE
      ? `${process.env.N8N_WEBHOOK_BASE.replace(/\/$/, "")}/consultorio-correo`
      : null);
  if (!url) return { salio: false, porque: "Falta conectar el flujo de correo en n8n." };
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(correo),
    });
    return r.ok
      ? { salio: true }
      : { salio: false, porque: `n8n contestó ${r.status}: el correo no salió.` };
  } catch {
    return { salio: false, porque: "No se pudo hablar con n8n: el correo no salió." };
  }
}
