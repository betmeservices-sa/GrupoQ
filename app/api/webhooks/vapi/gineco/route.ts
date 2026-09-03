import { FRASES_HOSPITAL } from "@/lib/memoria-llamadas";
import { comoLista, comoTexto, diagnosticoMemoria, manejarMemoria } from "@/lib/memoria-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Memoria del agente de voz del Hospital Centro Ginecológico.
//
// Guarda todo lo relevante de la llamada, pedido por el hospital: el motivo, la
// especialidad, la doctora que la atiende, los estudios de los que se habló y si
// quedó una cita. Es lo mismo que anota una recepcionista cuando reconoce a una
// paciente que vuelve, y es lo que permite que la segunda llamada no empiece de
// cero.
//
// La ruta es PÚBLICA (la llama Vapi desde sus servidores, ver middleware.ts) y
// valida el secreto compartido.

const OPCIONES = {
  tenant: "gineco",
  tenantFicha: "hospital",
  frases: FRASES_HOSPITAL,
  extraer: (d: Record<string, unknown>, resumen?: string) => ({
    nombre: comoTexto(d.nombre),
    // Temas de la llamada: especialidad, estudios, área. Se reusa el campo
    // "modelos" del modelo compartido para no tener dos formas de lo mismo.
    modelos: comoLista(d.temas),
    // En un hospital "uso" es el motivo por el que consulta, y "pago" es con
    // quién se atiende. Mismos campos, otro significado según el tenant.
    uso: comoTexto(d.motivo),
    pago: comoTexto(d.doctora),
    agendo: d.agendo === true,
    resumen: comoTexto(d.resumen) ?? comoTexto(resumen),
  }),
};

export const GET = (req: Request) => diagnosticoMemoria(req);
export const POST = (req: Request) => manejarMemoria(req, OPCIONES);
