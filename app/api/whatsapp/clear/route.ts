import { NextResponse } from "next/server";
import { clearHistory } from "@/lib/wa-store";
import { borrarEstadosSucursalDeTenant } from "@/lib/sucursal-store";
import { tenantFromRequest } from "@/lib/tenants/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Borra el historial de WhatsApp del cliente que pide (para reiniciar el demo).
//
// Se lleva TAMBIÉN el estado de sede. Si se borrara solo el historial, el agente
// empezaría la conversación nueva con el contador de intentos de la anterior:
// creería que ya preguntó dos veces por el hotel y pasaría el chat a una persona
// al primer mensaje.
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  await clearHistory(tenant);
  await borrarEstadosSucursalDeTenant(tenant);
  return NextResponse.json({ ok: true, tenant });
}
