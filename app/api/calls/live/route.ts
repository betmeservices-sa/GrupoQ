import { NextResponse } from "next/server";
import { fetchLlamadasEnCurso } from "@/lib/vapi-live";
import { tenantFromRequest } from "@/lib/tenants/server";
import { esAgencia, soloDelTenant, veModuloVoz } from "@/lib/tenants/voz";

// Endpoint liviano para el indicador "en vivo". No persiste nada ni calcula
// metricas: solo responde si hay alguien en linea ahora mismo.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const tenant = tenantFromRequest(req);
  if (!veModuloVoz(tenant)) {
    return NextResponse.json({ error: "Este módulo no está habilitado." }, { status: 403 });
  }

  const estado = await fetchLlamadasEnCurso();

  // Un cliente solo ve lo de su agente. El desglose por linea es de la cuenta
  // completa, asi que para el cliente no se manda: seria mostrarle las lineas
  // de otros clientes.
  const cuerpo = esAgencia(tenant)
    ? estado
    : (() => {
        const activas = soloDelTenant(estado.activas, tenant);
        return {
          ...estado,
          activas,
          total: activas.length,
          hablando: activas.filter((a) => a.hablando).length,
          porNumero: [],
        };
      })();

  return NextResponse.json(cuerpo, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
