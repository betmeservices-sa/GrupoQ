import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import { assistantIdsDeTenant, esAgencia, esDelTenant, veModuloVoz } from "@/lib/tenants/voz";
import { fetchVapiAgentes, hayLlaveVapi, lanzarLlamadaVapi } from "@/lib/vapi";
import { normalizarDestinoSV } from "@/lib/phone";
import { upsertContacto } from "@/lib/contacts-store";
import { normalizarTelefono } from "@/lib/memoria-llamadas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Lanzar una tanda de llamadas: lo que dispara el CSV de leads.
//
// Cada llamada cuesta plata y NO se puede deshacer, asi que esto no se activa
// solo por subir un archivo. Quien llama tiene que pedirlo explicitamente, y
// aun asi hay tope: una lista mal armada no puede convertirse en doscientas
// llamadas a gente real.
//
// Van de a una y espaciadas. Disparar cincuenta a la vez es la forma mas rapida
// de que el trunk las rechace en bloque y de quedarse sin saber cuales salieron.

/** Nadie marca a mas gente que esto de una sentada. */
const TOPE = 25;
/** Respiro entre llamada y llamada. */
const ESPERA_MS = 1200;

interface Destino {
  telefono?: string;
  nombre?: string;
}

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (!veModuloVoz(tenant)) {
    return NextResponse.json({ ok: false, error: "Este módulo no está habilitado." }, { status: 403 });
  }

  let body: { destinos?: Destino[]; assistantId?: string; confirmado?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido" }, { status: 400 });
  }

  // El seguro. Sin esto no sale ninguna llamada, por mas que venga la lista.
  if (body.confirmado !== true) {
    return NextResponse.json(
      { ok: false, error: "Falta confirmar. Esto lanza llamadas reales." },
      { status: 400 },
    );
  }

  if (!hayLlaveVapi()) {
    return NextResponse.json(
      { ok: false, error: "Estás en modo demostración (falta VAPI_PRIVATE_KEY): no se puede llamar." },
      { status: 409 },
    );
  }

  const pedido = body.assistantId?.trim();
  const assistantId = esAgencia(tenant)
    ? pedido
    : esDelTenant(pedido, tenant)
      ? pedido
      : assistantIdsDeTenant(tenant)[0];
  if (!assistantId) {
    return NextResponse.json({ ok: false, error: "Este cliente no tiene agente." }, { status: 400 });
  }

  // La linea desde la que se marca: la del agente si tiene, y si no cualquiera
  // del mismo cliente. Un agente de salida no atiende entrante y por eso puede
  // no tener numero propio.
  const agentes = await fetchVapiAgentes();
  const delAgente = agentes.find((a) => a.id === assistantId)?.numeros ?? [];
  const delTenant = agentes
    .filter((a) => esDelTenant(a.id, tenant))
    .flatMap((a) => a.numeros);
  const phoneNumberId = (delAgente[0] ?? delTenant[0])?.id;
  if (!phoneNumberId) {
    return NextResponse.json(
      { ok: false, error: "No hay ninguna línea para marcar." },
      { status: 400 },
    );
  }

  // Se limpia ANTES de contar contra el tope: si la mitad de la lista trae
  // numeros invalidos, el tope no se gasta en filas que no iban a salir.
  const vistos = new Set<string>();
  const destinos = (body.destinos ?? [])
    .map((d) => ({ e164: normalizarDestinoSV(d.telefono ?? ""), nombre: (d.nombre ?? "").trim() }))
    .filter((d): d is { e164: string; nombre: string } => {
      if (!d.e164 || vistos.has(d.e164)) return false;
      vistos.add(d.e164);
      return true;
    })
    .slice(0, TOPE);

  if (destinos.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Ningún número válido. Deben ser 8 dígitos de El Salvador." },
      { status: 400 },
    );
  }

  const lanzadas: { numero: string; id: string }[] = [];
  const fallidas: { numero: string; error: string }[] = [];

  for (const d of destinos) {
    try {
      // La ficha primero: si la llamada no entra, el intento igual queda.
      const partes = d.nombre.split(/\s+/).filter(Boolean);
      await upsertContacto({
        from: normalizarTelefono(d.e164),
        tenant,
        ...(partes.length > 0 ? { nombre: partes[0], apellido: partes.slice(1).join(" ") } : {}),
      }).catch(() => undefined);

      const ll = await lanzarLlamadaVapi({
        assistantId,
        phoneNumberId,
        numero: d.e164,
        variables: { nombre: d.nombre || "no disponible" },
      });
      lanzadas.push({ numero: d.e164, id: ll.id });
    } catch (err) {
      fallidas.push({ numero: d.e164, error: err instanceof Error ? err.message : "Error" });
    }
    if (destinos.indexOf(d) < destinos.length - 1) {
      await new Promise((r) => setTimeout(r, ESPERA_MS));
    }
  }

  return NextResponse.json({
    ok: true,
    lanzadas: lanzadas.length,
    fallidas: fallidas.length,
    detalle: { lanzadas, fallidas },
    recortado: (body.destinos ?? []).length > TOPE ? TOPE : null,
  });
}
