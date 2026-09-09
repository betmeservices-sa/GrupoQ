import { after, NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import {
  ETIQUETA_ORIGEN,
  assistantDeTanda,
  esAgencia,
  esDelTenant,
  esOrigenTanda,
  veModuloVoz,
  type OrigenTanda,
} from "@/lib/tenants/voz";
import { fetchVapiAgentes, hayLlaveVapi, lanzarLlamadaVapi } from "@/lib/vapi";
import { normalizarDestinoSV } from "@/lib/phone";
import { upsertContacto } from "@/lib/contacts-store";
import { normalizarTelefono } from "@/lib/memoria-llamadas";
import { vendedoresDe } from "@/lib/ventas-equipo";
import { siguienteVendedor } from "@/lib/ventas-pipeline";
import { asegurarSolicitud, asignarVendedor, listarSolicitudes, registrarEvento } from "@/lib/ventas-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// La tanda ya no dispara todo de una: espacia las llamadas, y eso toma
// minutos. El maximo del plan es 300s y de ahi sale cuantas caben.
export const maxDuration = 300;

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

// Cuanto se espera entre una llamada y la siguiente.
//
// Empezo en 10 s mirando las llamadas reales del 2026-09-07: de 11 llamadas
// SUELTAS no fallo ninguna, y de 10 tandas disparadas con 1 a 3 segundos de
// diferencia, 4 perdieron una con
// "providerfault-outbound-sip-503-service-unavailable", con el trunk ocioso y
// sin nada hablando. O sea el carrier no aguanta la rafaga, pero no sabiamos
// donde estaba el limite.
//
// Baja a 5 s por pedido del 2026-09-09: 10 hacia demasiado lenta una tanda de
// 25 (mas de cuatro minutos solo esperando). 5 sigue estando muy por encima de
// los 1 a 3 segundos que fallaban. SI VUELVEN LOS 503 EN TANDA, subirlo es lo
// primero que hay que probar, y se puede sin desplegar con
// TANDA_ESPERA_SEGUNDOS.
const ESPERA_MS = (() => {
  const s = Number(process.env.TANDA_ESPERA_SEGUNDOS);
  return Math.min(60, Math.max(1, Number.isFinite(s) && s > 0 ? s : 5)) * 1000;
})();

/** Margen dentro del maxDuration para que la ultima llamada quepa entera. */
const PRESUPUESTO_MS = 270_000;

interface Destino {
  telefono?: string;
  nombre?: string;
}

export async function POST(req: Request) {
  const tenant = tenantFromRequest(req);
  if (!veModuloVoz(tenant)) {
    return NextResponse.json({ ok: false, error: "Este módulo no está habilitado." }, { status: 403 });
  }

  let body: { destinos?: Destino[]; assistantId?: string; confirmado?: boolean; origen?: string };
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

  // Con que guion se marca. Por defecto el de primer contacto, que es el que
  // habia antes de que existiera esta eleccion.
  const origen: OrigenTanda = esOrigenTanda(body.origen) ? body.origen : "primer_contacto";
  const etiquetaOrigen = ETIQUETA_ORIGEN[origen];

  const pedido = body.assistantId?.trim();
  const assistantId = esAgencia(tenant)
    ? (pedido ?? assistantDeTanda(tenant, origen))
    : esDelTenant(pedido, tenant)
      ? pedido
      : assistantDeTanda(tenant, origen);
  if (!assistantId) {
    return NextResponse.json(
      {
        ok: false,
        error:
          origen === "reactivacion"
            ? "Este cliente no tiene agente de reactivación. No se marca con el de primer contacto: el guion no sirve para quien ya dejó su solicitud."
            : "Este cliente no tiene agente.",
      },
      { status: 400 },
    );
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
    .slice(0, Math.min(TOPE, Math.floor(PRESUPUESTO_MS / ESPERA_MS) + 1));

  if (destinos.length === 0) {
    return NextResponse.json(
      { ok: false, error: "Ningún número válido. Deben ser 8 dígitos de El Salvador." },
      { status: 400 },
    );
  }

  const equipo = vendedoresDe(tenant);

  // Las fichas van TODAS primero, antes de marcarle a nadie: si algo se cae a
  // mitad de la tanda, los contactos ya quedaron y se puede repetir sin perder
  // a quien nunca llego a sonar.
  //
  // Y ENTRAN AL PIPELINE, que es lo que faltaba: se subia el CSV, la llamada
  // salia y la nota se actualizaba, pero la persona no aparecia en ninguna
  // etapa del embudo. Un lead al que ya le marcamos y que no esta en el
  // tablero es un lead que nadie va a volver a tocar.
  for (const d of destinos) {
    const partes = d.nombre.split(/\s+/).filter(Boolean);
    const clave = normalizarTelefono(d.e164);
    await upsertContacto({
      from: clave,
      tenant,
      ...(partes.length > 0 ? { nombre: partes[0], apellido: partes.slice(1).join(" ") } : {}),
    }).catch(() => undefined);
    // Entra al embudo con el mismo reparto que usa el motor, igual que si
    // hubiera escrito. Si ya estaba, `asegurarSolicitud` no lo duplica.
    if (equipo.length > 0) {
      try {
        const solicitud = await asegurarSolicitud(tenant, clave, { nombre: d.nombre || undefined });
        if (!solicitud.vendedor) {
          const toca = siguienteVendedor(equipo, await listarSolicitudes(tenant));
          if (toca) await asignarVendedor(tenant, clave, toca.id, "tanda", toca.nombre);
        }
        await registrarEvento(tenant, clave, "creado", "tanda", `entró por el CSV (${etiquetaOrigen})`);
      } catch (err) {
        // Que no entre al embudo no puede impedir la llamada: el CSV se subió
        // para marcar, y la ficha ya quedó.
        console.error(`[tanda] no entró al embudo ${clave}:`, err);
      }
    }
  }

  const marcar = (d: { e164: string; nombre: string }) =>
    lanzarLlamadaVapi({
      assistantId,
      phoneNumberId,
      numero: d.e164,
      variables: { nombre: d.nombre || "no disponible" },
    });

  // La primera sale ya y en linea: es la que dice si el trunk esta contestando.
  // Si esa no entra, no tiene sentido dejar corriendo las otras veinticuatro.
  const [primera, ...resto] = destinos;
  const fallidas: { numero: string; error: string }[] = [];
  let lanzadas = 0;
  try {
    await marcar(primera);
    lanzadas = 1;
  } catch (err) {
    fallidas.push({ numero: primera.e164, error: err instanceof Error ? err.message : "Error" });
  }

  // El resto sale espaciado y DESPUES de responder. Espaciado porque el carrier
  // rechaza las rafagas, y despues de responder para que quien subio el CSV no
  // se quede mirando una pantalla cargando varios minutos.
  if (resto.length > 0 && lanzadas > 0) {
    after(async () => {
      for (const d of resto) {
        await new Promise((r) => setTimeout(r, ESPERA_MS));
        try {
          await marcar(d);
        } catch (err) {
          // No se reintenta desde aca: lo que el carrier rechaza queda visible
          // en Llamadas, y decidir si se vuelve a marcar no es de este codigo.
          console.error(`[tanda] no salio ${d.e164}:`, err);
        }
      }
    });
  }

  return NextResponse.json({
    ok: true,
    lanzadas,
    programadas: lanzadas > 0 ? resto.length : 0,
    fallidas: fallidas.length,
    espaciadoSegundos: ESPERA_MS / 1000,
    detalle: { fallidas },
    recortado: (body.destinos ?? []).length > destinos.length ? destinos.length : null,
  });
}
