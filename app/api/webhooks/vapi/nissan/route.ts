import { comoLista, comoTexto, diagnosticoMemoria, manejarMemoria } from "@/lib/memoria-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Memoria del agente de voz de Nissan.
//
// Mismo criterio que toyota: se guarda qué modelos miró, para qué lo quiere y
// cómo pensaba pagarlo, porque en un concesionario esa es la información que
// sirve para retomar la conversación sin volver a preguntar todo.
//
// El tenant es lo único que cambia respecto de toyota, y tiene que ser distinto
// para que las dos marcas no se pisen la memoria del mismo teléfono: la misma
// persona puede haber llamado a las dos.
//
// La ruta es PÚBLICA (la llama Vapi desde sus servidores) y valida el secreto
// compartido.

const OPCIONES = {
  tenant: "nissan",
  extraer: (d: Record<string, unknown>, resumen?: string) => ({
    nombre: comoTexto(d.nombre),
    modelos: comoLista(d.modelos),
    uso: comoTexto(d.uso),
    pago: comoTexto(d.pago),
    agendo: d.agendo === true,
    resumen: comoTexto(d.resumen) ?? comoTexto(resumen),
  }),
};

export const GET = (req: Request) => diagnosticoMemoria(req);
export const POST = (req: Request) => manejarMemoria(req, OPCIONES);
