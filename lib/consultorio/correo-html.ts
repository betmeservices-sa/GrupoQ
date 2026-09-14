// El correo, en HTML.
//
// Se arma acá y no en n8n para que el flujo del otro lado no tenga que saber
// nada de recetas: recibe `html` y lo manda. El día que cambie el formato, se
// cambia con el resto del módulo y no hay que abrir n8n.
//
// Reglas de un correo que se ve bien en un teléfono y en Outlook:
//   - Estilos EN LÍNEA, no <style>: Gmail recorta la cabecera y Outlook ignora
//     buena parte del CSS externo.
//   - Tablas para el ancho, no flex ni grid: Outlook usa el motor de Word.
//   - Nada de fuentes web ni imágenes remotas: la receta tiene que leerse
//     aunque el cliente de correo bloquee todo.
//   - Ancho máximo de 600 px, que es lo que cabe sin zoom.

import { NOMBRE_TIPO, agruparDe, conLado } from "./catalogos";
import type { Doctor, Documento, Paciente } from "./tipos";

const TINTA = "#10202a";
const SUAVE = "#536872";
const LINEA = "#e2e9e7";
const VERDE = "#0e7c6b";
const FUENTE = "Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const escapar = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString("es-SV", { day: "numeric", month: "long", year: "numeric" });

/** Los renglones del medio: medicamentos o estudios, según el documento. */
function cuerpo(doc: Documento): string {
  if (doc.tipo === "receta") {
    return doc.medicamentos
      .map(
        (m, i) => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid ${LINEA};vertical-align:top;width:26px;font:400 15px ${FUENTE};color:${SUAVE};">${i + 1}.</td>
        <td style="padding:10px 0;border-bottom:1px solid ${LINEA};">
          <div style="font:400 16px ${FUENTE};color:${TINTA};">${escapar(m.nombre)}</div>
          <div style="margin-top:3px;font:400 13px ${SANS};color:${SUAVE};">${[m.dosis, m.frecuencia, m.duracion]
            .filter(Boolean)
            .map(escapar)
            .join(" · ")}</div>
        </td>
      </tr>`,
      )
      .join("");
  }

  // Agrupados por área, como en la hoja impresa. Sin el área, un renglón que
  // dice "Tiroides" no dice si es el ultrasonido o la prueba de sangre: en el
  // papel eso lo resuelve la columna donde está.
  return agruparDe(doc.tipo, doc.examenes)
    .map(
      (g) => `
      <tr>
        <td colspan="2" style="padding:16px 0 4px;font:600 12px ${SANS};color:${SUAVE};letter-spacing:.04em;text-transform:uppercase;">${escapar(g.area)}</td>
      </tr>
      ${g.examenes
        .map((e) => {
          const nota = e.nota
            ? `<div style="margin-top:3px;font:400 13px ${SANS};color:${SUAVE};">${escapar(e.nota)}</div>`
            : "";
          return `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid ${LINEA};vertical-align:top;width:26px;font:400 13px ${SANS};color:${SUAVE};">•</td>
        <td style="padding:8px 0;border-bottom:1px solid ${LINEA};">
          <div style="font:400 15px ${FUENTE};color:${TINTA};">${escapar(conLado(e.id, doc.lados))}</div>
          ${e.codigo ? `<div style="margin-top:2px;font:400 12px ${SANS};color:${SUAVE};letter-spacing:.04em;">${escapar(e.codigo)}</div>` : ""}
          ${nota}
        </td>
      </tr>`;
        })
        .join("")}`,
    )
    .join("");
}

export function armarHtml(
  doc: Documento,
  paciente: Paciente,
  doctor: Doctor,
  clinica: string,
): string {
  const titulo = doc.tipo === "receta" ? "Receta médica" : NOMBRE_TIPO[doc.tipo];

  // Lo que el paciente tiene que hacer con esto. En la receta, nada: se lleva a
  // la farmacia. En una orden, el código es lo que le ahorra la fila.
  const llamada =
    doc.tipo === "receta"
      ? ""
      : `
      <tr>
        <td style="padding:18px 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e4f2ee;border-left:3px solid ${VERDE};">
            <tr>
              <td style="padding:14px 16px;font:400 14px ${SANS};color:${TINTA};line-height:1.5;">
                Al llegar, dé este código en recepción y le marcamos todo sin que llene nada:
                <div style="margin-top:6px;font:700 20px ${SANS};letter-spacing:.12em;color:${TINTA};">${escapar(doc.codigo)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>`;

  const indicaciones = doc.indicaciones
    ? `
      <tr>
        <td style="padding:18px 0 0;font:400 14px ${SANS};color:${TINTA};line-height:1.6;">
          <strong style="font-weight:600;">Indicaciones:</strong> ${escapar(doc.indicaciones)}
        </td>
      </tr>`
    : "";

  // El dato clínico va en la orden y no en la receta: es lo que el técnico y el
  // radiólogo necesitan saber para tomar bien el estudio y para leerlo. En la
  // hoja impresa es el renglón de "datos clínicos del paciente".
  const diagnostico =
    doc.tipo !== "receta" && doc.diagnostico
      ? `
      <tr>
        <td style="padding:14px 0 0;font:400 14px ${SANS};color:${TINTA};line-height:1.6;">
          <strong style="font-weight:600;">Datos clínicos:</strong> ${escapar(doc.diagnostico)}
        </td>
      </tr>`
      : "";

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapar(titulo)}</title></head>
<body style="margin:0;padding:0;background:#eef2f1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f1;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border:1px solid ${LINEA};border-top:3px solid ${TINTA};">
          <tr>
            <td style="padding:28px 32px 0;">

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1.5px solid ${TINTA};padding-bottom:12px;">
                <tr>
                  <td style="vertical-align:top;">
                    <div style="font:400 20px ${FUENTE};color:${TINTA};">${escapar(doctor.nombre)}</div>
                    <div style="margin-top:2px;font:400 12.5px ${SANS};color:${SUAVE};">${escapar(doctor.especialidad)} · ${escapar(doctor.registro)}</div>
                  </td>
                  <td style="vertical-align:top;text-align:right;">
                    <div style="font:400 15px ${FUENTE};color:${TINTA};">${escapar(titulo)}</div>
                    <div style="margin-top:2px;font:400 12.5px ${SANS};color:${SUAVE};">${escapar(fechaLarga(doc.fecha))}</div>
                    <div style="margin-top:4px;font:400 13px ${SANS};color:${TINTA};letter-spacing:.1em;">${escapar(doc.codigo)}</div>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:16px 0 4px;font:400 14px ${SANS};color:${SUAVE};">
                    Para <span style="font:400 16px ${FUENTE};color:${TINTA};">${escapar(paciente.nombre)}</span>
                  </td>
                </tr>
                ${cuerpo(doc)}
                ${diagnostico}
                ${indicaciones}
                ${llamada}
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-top:1px solid ${LINEA};">
                <tr>
                  <td style="padding:14px 0 28px;font:400 12.5px ${SANS};color:${SUAVE};line-height:1.6;">
                    ${escapar(clinica)} · ${escapar(doctor.telefono)}<br>
                    Este correo se generó desde el expediente de ${escapar(paciente.nombre)}. Si no es para usted, por favor bórrelo.
                  </td>
                </tr>
              </table>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
