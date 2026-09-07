import { comoTexto, diagnosticoMemoria, manejarMemoria } from "@/lib/memoria-webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Qué queda de una llamada de seguimiento de solicitud de crédito (CrediQ).
//
// Lo que importa son dos datos que la llamada existe para averiguar: qué
// vehículo quiere y de cuánto la anda pensando. Esos dos van a la ficha, que es
// donde el vendedor los va a buscar, y no solo a la memoria del agente.
//
// La ruta es PÚBLICA (la llama Vapi desde sus servidores) y valida el secreto.

const OPCIONES = {
  tenant: "solicitudes",
  tenantFicha: "grupoq",
  extraer: (d: Record<string, unknown>, resumen?: string) => ({
    nombre: comoTexto(d.nombre),
    // `modelos` es la lista de vehículos del extracto compartido: acá es uno
    // solo, el que dijo por teléfono.
    modelos: comoTexto(d.vehiculo) ? [comoTexto(d.vehiculo) as string] : [],
    // `uso` guarda de cuánto la piensa. Se reusa el campo en vez de agregar uno
    // nuevo al extracto, que sirve a cinco agentes.
    uso: comoTexto(d.monto),
    agendo: d.acepta_whatsapp === true,
    resumen: comoTexto(d.resumen) ?? comoTexto(resumen),
  }),
  // La redacción del concesionario diría "lo quiere para quince mil dólares".
  // Acá el campo significa monto, no uso, así que la nota se escribe aparte.
  nota: (e: { modelos?: string[]; uso?: string; resumen?: string }) => {
    const partes: string[] = [];
    if (e.modelos?.length) partes.push(`le interesa ${e.modelos.join(", ")}`);
    if (e.uso) partes.push(`la piensa de ${e.uso}`);
    if (partes.length === 0 && e.resumen) partes.push(e.resumen);
    if (partes.length === 0) return undefined;
    const texto = `Solicitud de crédito. ${partes.join(", ")}`;
    return texto.endsWith(".") ? texto : `${texto}.`;
  },
};

export const GET = (req: Request) => diagnosticoMemoria(req);
export const POST = (req: Request) => manejarMemoria(req, OPCIONES);
