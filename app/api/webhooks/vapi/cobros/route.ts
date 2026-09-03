import { comoTexto, diagnosticoMemoria, manejarMemoria } from "@/lib/memoria-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Qué queda de una llamada de cobros de CrediQ (Grupo Q).
//
// Lo que importa acá no es qué carro miró, es qué contestó sobre el pago: si ya
// pagó, si va a pagar, o si pidió que lo llame un asesor. Por eso el extracto no
// se parece al del agente de ventas aunque compartan el manejador.
//
// La memoria va en su propio espacio ("cobros"), separada de la de ventas: la
// misma persona puede estar comprando un carro y a la vez debiendo una cuota, y
// mezclar las dos conversaciones haría que el agente de ventas hable de deudas.
// La FICHA en cambio es una sola y es del cliente del panel (grupoq): es la
// misma persona.
//
// La ruta es PÚBLICA (la llama Vapi desde sus servidores) y valida el secreto.

const OPCIONES = {
  tenant: "cobros",
  tenantFicha: "grupoq",
  extraer: (d: Record<string, unknown>, resumen?: string) => ({
    nombre: comoTexto(d.nombre),
    // Se reusan los campos del extracto: `uso` guarda en qué quedó el pago y
    // `pago` la fecha que la persona dijo. Renombrarlos obligaría a tocar el
    // manejador y el store, que hoy sirven a cuatro agentes.
    uso: comoTexto(d.resultado),
    pago: comoTexto(d.fecha_ofrecida),
    // true solo si quedó un compromiso de pago concreto.
    agendo: d.se_compromete === true,
    resumen: comoTexto(d.resumen) ?? comoTexto(resumen),
  }),
  // La redacción del concesionario acá no sirve: escribía "lo quiere para ya se
  // le recordó", porque el campo `uso` guarda otra cosa en cobros.
  nota: (e: { uso?: string; pago?: string; resumen?: string }) => {
    const partes: string[] = [];
    if (e.uso) partes.push(`quedó en: ${e.uso}`);
    if (e.pago) partes.push(`dijo que paga el ${e.pago}`);
    if (partes.length === 0 && e.resumen) partes.push(e.resumen);
    if (partes.length === 0) return undefined;
    const texto = `Recordatorio de cuota. ${partes.join(", ")}`;
    return texto.endsWith(".") ? texto : `${texto}.`;
  },
};

export const GET = (req: Request) => diagnosticoMemoria(req);
export const POST = (req: Request) => manejarMemoria(req, OPCIONES);
