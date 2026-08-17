import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { assistantIdDeTenant } from "@/lib/tenants/voz";
import {
  CONCURRENCIA_MAX,
  MAX_ITEMS_CAMPANA,
  VENTANA_POR_DEFECTO,
  duracionHumana,
  estimarMinutos,
} from "@/lib/cobros-campanas";
import { filtrarCartera, hoyEnSv, ordenarPorPrioridad, resolverDeudor } from "@/lib/cobros-cartera";
import {
  buscarDeudor,
  crearCampana,
  promesasDeCampana,
  resumirCampana,
  todasLasCampanas,
  todosLosDeudores,
} from "@/lib/cobros-store";
import { fetchVapiNumeros } from "@/lib/vapi";
import type {
  EstadoGestion,
  ItemCampana,
  ProductoCredito,
  TramoMora,
  VentanaLlamado,
} from "@/lib/cobros-tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (tenantFromRequest(req) !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  // Los números disponibles se piden acá para que la pantalla de "nueva
  // campaña" no tenga que adivinar desde dónde se marca.
  const numeros = await fetchVapiNumeros().catch(() => []);

  return NextResponse.json({
    ok: true,
    // Con las promesas ya contadas: la tarjeta del listado y el detalle tienen
    // que decir el mismo número, o el usuario deja de creerle a los dos.
    campanas: todasLasCampanas().map((c) => resumirCampana(c, promesasDeCampana(c))),
    numeros: numeros.map((n) => ({ id: n.id, numero: n.numero, nombre: n.nombre })),
    concurrenciaMax: CONCURRENCIA_MAX,
    ventanaPorDefecto: VENTANA_POR_DEFECTO,
    // Si no hay telefonía, ni siquiera se ofrece marcar de verdad.
    hayTelefonia: Boolean(process.env.VAPI_PRIVATE_KEY),
  });
}

interface Filtro {
  tramo?: TramoMora | "todos";
  estado?: EstadoGestion | "todos";
  producto?: ProductoCredito | "todos";
  riesgo?: "bajo" | "medio" | "alto" | "todos";
  soloPromesaVencida?: boolean;
}

interface Cuerpo {
  nombre?: string;
  phoneNumberId?: string;
  concurrencia?: number;
  maxIntentos?: number;
  minutosEntreIntentos?: number;
  ventana?: VentanaLlamado;
  // De dónde salen los contactos: un filtro sobre la cartera, o una lista de
  // ids (lo que devolvió la importación del archivo).
  filtro?: Filtro;
  ids?: string[];
  origenArchivo?: string;
  // true = queda en borrador; false/ausente = arranca de una vez.
  borrador?: boolean;
  // true = marca DE VERDAD. Ausente o false = simulada. Se pide explícito
  // porque la cartera sembrada del demo lleva teléfonos inventados.
  real?: boolean;
}

function entero(v: unknown, def: number, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function ventanaValida(v: VentanaLlamado | undefined): VentanaLlamado {
  if (!v) return VENTANA_POR_DEFECTO;
  const inicio = entero(v.horaInicio, VENTANA_POR_DEFECTO.horaInicio, 0, 23);
  const fin = entero(v.horaFin, VENTANA_POR_DEFECTO.horaFin, 1, 24);
  const dias = Array.isArray(v.dias)
    ? Array.from(new Set(v.dias.map((d) => entero(d, 1, 0, 6)))).sort()
    : VENTANA_POR_DEFECTO.dias;
  return {
    horaInicio: Math.min(inicio, fin - 1),
    horaFin: fin,
    dias: dias.length > 0 ? dias : VENTANA_POR_DEFECTO.dias,
  };
}

/**
 * Arma una campaña de llamadas.
 *
 * Acá es donde se materializa el "llamalos de diez en diez": la campaña guarda
 * la cola completa (hasta 20,000) y la concurrencia. Nadie marca nada al
 * crearla; quien marca es el tick.
 */
export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (tenant !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  const assistantId = assistantIdDeTenant(tenant);
  if (!assistantId) {
    return NextResponse.json(
      { ok: false, error: "Este cliente no tiene agente de voz configurado." },
      { status: 400 },
    );
  }

  let body: Cuerpo;
  try {
    body = (await req.json()) as Cuerpo;
  } catch {
    return NextResponse.json({ ok: false, error: "No se entendió la petición." }, { status: 400 });
  }

  const hoy = hoyEnSv();

  // Los candidatos salen de una lista explícita de ids o de un filtro sobre la
  // cartera. En los dos casos se descartan los no llamables: una cuenta que
  // pidió no ser contactada no vuelve a entrar por la puerta de atrás.
  const candidatos = body.ids?.length
    ? body.ids.map((id) => buscarDeudor(id)).filter((d): d is NonNullable<typeof d> => d !== null)
    : ordenarPorPrioridad(
        filtrarCartera(
          todosLosDeudores().map((d) => resolverDeudor(d, hoy)),
          { ...(body.filtro ?? {}), soloLlamables: true },
        ),
      );

  const llamables = candidatos.filter((d) => d.llamable);
  if (llamables.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Ninguna cuenta de esa selección se puede llamar." },
      { status: 400 },
    );
  }

  const concurrencia = entero(body.concurrencia, 10, 1, CONCURRENCIA_MAX);
  const items: Omit<ItemCampana, "id">[] = llamables.slice(0, MAX_ITEMS_CAMPANA).map((d) => ({
    deudorId: d.id,
    nombre: d.nombre,
    telefono: d.telefono,
    estado: "pendiente",
    intentos: 0,
    actualizado: new Date().toISOString(),
  }));

  // Solo marca de verdad si se pidió Y hay telefonía. Cualquiera de las dos
  // cosas que falte deja la campaña en simulación, nunca al revés.
  const simulada = !(body.real === true && Boolean(process.env.VAPI_PRIVATE_KEY));

  const campana = crearCampana({
    nombre: (body.nombre ?? "").trim() || `Campaña del ${hoy}`,
    estado: body.borrador ? "borrador" : "corriendo",
    iniciada: body.borrador ? undefined : new Date().toISOString(),
    assistantId,
    phoneNumberId: body.phoneNumberId ?? "",
    concurrencia,
    maxIntentos: entero(body.maxIntentos, 3, 1, 6),
    minutosEntreIntentos: entero(body.minutosEntreIntentos, 120, 5, 1440),
    ventana: ventanaValida(body.ventana),
    origenArchivo: body.origenArchivo,
    simulada,
    items,
  });

  const minutos = estimarMinutos(items.length, concurrencia);

  return NextResponse.json({
    ok: true,
    campana: resumirCampana(campana),
    // Se devuelve la estimación para que nadie arranque 10,000 llamadas de 10
    // en 10 creyendo que termina en la tarde.
    estimado: { minutos, humano: duracionHumana(minutos) },
    simulada,
    // Cuentas que quedaron fuera por no ser llamables.
    excluidas: candidatos.length - llamables.length,
    truncadas: Math.max(0, llamables.length - MAX_ITEMS_CAMPANA),
  });
}
