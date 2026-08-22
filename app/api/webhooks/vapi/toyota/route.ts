import { comoLista, comoTexto, diagnosticoMemoria, manejarMemoria } from "@/lib/memoria-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Memoria del agente de voz de Toyota (Excel Automotriz).
//
// Acá se guarda todo lo que se habló: qué modelos miró, para qué lo quiere y
// cómo pensaba pagarlo. Es información comercial y sirve toda.
//
// La ruta es PÚBLICA (la llama Vapi desde sus servidores, ver middleware.ts) y
// valida el secreto compartido.

const OPCIONES = {
  tenant: "toyota",
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
