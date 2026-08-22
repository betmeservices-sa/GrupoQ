import { comoLista, comoTexto, diagnosticoMemoria, manejarMemoria } from "@/lib/memoria-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Memoria del agente de voz del Hospital Centro Ginecológico.
//
// NO es la misma memoria que la del concesionario, y la diferencia es a
// propósito. Acá lo que se conversa es salud: por qué la operaron, si perdió un
// embarazo, qué resultado esperaba. Guardar eso convierte una libreta de
// recepción en un expediente clínico paralelo, sin consentimiento, sin las
// protecciones que un expediente tiene y en una tabla que lee la app entera.
//
// Entonces se guarda lo ADMINISTRATIVO y nada más:
//   sí   el nombre, el área con la que trata, si tiene cita pendiente.
//   NO   síntomas, diagnósticos, resultados, tratamientos, embarazos, pérdidas.
//
// El filtro está acá abajo además de estar en el guion del extractor, porque una
// sola línea de defensa contra esto no alcanza: si al modelo se le escapa un
// síntoma, no tiene que llegar a la base.

/** Palabras que delatan contenido clínico. Si aparecen, el campo se descarta. */
const CLINICO =
  /(embaraz|aborto|p[eé]rdida|sangr|dolor|s[ií]ntoma|diagn[oó]stic|tratamient|resultado|examen|biopsia|c[aá]ncer|tumor|quiste|infecci|cirug|ces[aá]rea|parto|menstrua|regla|fertil|anticoncep|papanicola|citolog|colposcop|ultrasonid|prueba|medicament|receta|VIH|ITS)/i;

const sinDatosDeSalud = (v: unknown): string | undefined => {
  const t = comoTexto(v);
  return t && !CLINICO.test(t) ? t : undefined;
};

const OPCIONES = {
  tenant: "gineco",
  extraer: (d: Record<string, unknown>, resumen?: string) => ({
    nombre: comoTexto(d.nombre),
    // "modelos" acá son las ÁREAS con las que ya trató (recepción, caja,
    // laboratorio). Se reusa el campo para no tener dos formas de lo mismo.
    modelos: comoLista(d.areas).filter((a) => !CLINICO.test(a)),
    uso: undefined,
    pago: undefined,
    agendo: d.agendo === true,
    resumen: sinDatosDeSalud(d.resumen) ?? sinDatosDeSalud(resumen),
  }),
};

export const GET = (req: Request) => diagnosticoMemoria(req);
export const POST = (req: Request) => manejarMemoria(req, OPCIONES);
