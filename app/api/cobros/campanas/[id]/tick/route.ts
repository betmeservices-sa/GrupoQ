import { NextResponse } from "next/server";
import { tenantFromRequest } from "@/lib/tenants/server";
import {
  campanaAgotada,
  cerrarItem,
  esVivo,
  planificarTanda,
} from "@/lib/cobros-campanas";
import { hoyEnSv } from "@/lib/cobros-cartera";
import { analizarLlamada, aplicarAnalisis, aplicarSinContacto, resultadoDeEndedReason } from "@/lib/cobros-ia";
import {
  analisisSimulado,
  duracionSimulada,
  resultadoSimulado,
  transcriptSimulado,
} from "@/lib/cobros-simulacion";
import {
  buscarCampana,
  buscarDeudor,
  guardarCampana,
  guardarDeudor,
  promesasDeCampana,
  resumirCampana,
} from "@/lib/cobros-store";
import { fetchVapiCall, lanzarLlamadaVapi, llamadaTerminada } from "@/lib/vapi";
import type { Campana, ItemCampana } from "@/lib/cobros-tipos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Quien decide si se marca de verdad es LA CAMPAÑA (campana.simulada), no el
// entorno. Tener la llave de Vapi puesta no puede ser suficiente para que un
// demo con teléfonos inventados empiece a llamarle a gente real.

// En simulación el análisis va precocido (ver lib/cobros-simulacion). Poner
// COBROS_IA_EN_SIMULACION=1 hace que el transcript simulado también pase por el
// modelo, para probar el camino completo sin telefonía. Cuesta dinero por
// llamada simulada, por eso está apagado.
const IA_EN_SIMULACION = () => process.env.COBROS_IA_EN_SIMULACION === "1";

function variablesDe(deudorId: string, hoy: string): Record<string, string> | undefined {
  const d = buscarDeudor(deudorId);
  if (!d) return undefined;
  const limite = new Date(Date.parse(`${hoy}T12:00:00Z`) + 3 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return {
    nombre: d.nombre,
    producto: d.producto,
    cuenta: d.cuenta,
    montoVencido: d.montoVencido.toFixed(2),
    diasMora: String(d.diasMora),
    cuotaMensual: d.cuotaMensual.toFixed(2),
    fechaLimite: limite,
  };
}

/**
 * Cierra un item vivo y deja la ficha del cliente al día.
 *
 * Es el punto donde se juntan las tres piezas: la telefonía dice cómo terminó
 * la llamada, el modelo dice qué significa lo que dijo el cliente, y la ficha
 * se mueve. Devuelve el item ya cerrado.
 */
async function cerrarConAnalisis(
  campana: Campana,
  item: ItemCampana,
  datos: {
    transcript?: string;
    duracionSeg?: number;
    costo?: number;
    endedReason?: string;
    grabacionUrl?: string;
    // Solo en simulación: el análisis ya viene armado.
    analisisPrecocido?: ReturnType<typeof analisisSimulado>;
  },
  ahora: Date,
): Promise<ItemCampana> {
  const hoy = hoyEnSv(ahora);
  const deudor = buscarDeudor(item.deudorId);

  // Sin transcripción no hay nada que leer: el resultado sale del motivo de
  // corte de la telefonía y no se gasta una llamada al modelo. En una base de
  // 10,000, esto es casi la mitad de los intentos.
  const sinContacto = resultadoDeEndedReason(datos.endedReason);
  if (deudor && sinContacto && !datos.transcript && !datos.analisisPrecocido) {
    guardarDeudor(
      aplicarSinContacto(deudor, sinContacto, {
        ahora,
        callId: item.callId,
        campanaId: campana.id,
        motivo: datos.endedReason,
      }),
    );
    return cerrarItem(item, { resultado: sinContacto, duracionSeg: 0, costo: datos.costo }, campana, ahora);
  }

  let analisis = datos.analisisPrecocido ?? null;

  if (!analisis && deudor && datos.transcript) {
    try {
      analisis = await analizarLlamada({
        deudor,
        transcript: datos.transcript,
        duracionSeg: datos.duracionSeg,
        endedReason: datos.endedReason,
      });
    } catch (err) {
      // Que el modelo falle no puede tumbar la campaña: se cierra el item con
      // el error visible y se sigue marcando. La llamada ya se hizo y se pagó.
      return cerrarItem(
        item,
        {
          duracionSeg: datos.duracionSeg,
          costo: datos.costo,
          error: err instanceof Error ? err.message : "No se pudo analizar la llamada.",
        },
        campana,
        ahora,
      );
    }
  }

  if (!analisis || !deudor) {
    return cerrarItem(
      item,
      { resultado: "sin_clasificar", duracionSeg: datos.duracionSeg, costo: datos.costo },
      campana,
      ahora,
    );
  }

  guardarDeudor(
    aplicarAnalisis(deudor, analisis, {
      ahora,
      hoy,
      callId: item.callId,
      campanaId: campana.id,
      duracionSeg: datos.duracionSeg,
      transcript: datos.transcript,
      grabacionUrl: datos.grabacionUrl,
    }),
  );

  return cerrarItem(
    item,
    { resultado: analisis.resultado, duracionSeg: datos.duracionSeg, costo: datos.costo },
    campana,
    ahora,
  );
}

/**
 * Hace avanzar la campaña un paso: cierra lo que ya terminó y marca lo que
 * quepa en los cupos libres.
 *
 * La pantalla lo llama cada pocos segundos mientras la campaña corre. Un cron
 * puede llamarlo igual: la ruta no depende de que haya alguien mirando, que es
 * justo lo que hace falta para una base de 10,000 que corre toda la tarde.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (tenantFromRequest(req) !== "promerica") {
    return NextResponse.json({ ok: false, error: "No disponible" }, { status: 403 });
  }

  const { id } = await params;
  let campana = buscarCampana(id);
  if (!campana) {
    return NextResponse.json({ ok: false, error: "Esa campaña ya no existe." }, { status: 404 });
  }

  const ahora = new Date();
  const hoy = hoyEnSv(ahora);
  // La llave se vuelve a mirar acá por si se cayó del entorno después de crear
  // la campaña: sin telefonía se simula, nunca se falla en silencio.
  const real = !campana.simulada && Boolean(process.env.VAPI_PRIVATE_KEY);
  const cerradas: string[] = [];
  const errores: string[] = [];

  // ── 1. Cerrar lo que ya terminó ──
  for (const item of campana.items.filter(esVivo)) {
    if (real && item.callId) {
      let call;
      try {
        call = await fetchVapiCall(item.callId);
      } catch (err) {
        errores.push(err instanceof Error ? err.message : "Vapi no respondió.");
        continue;
      }
      // Sin registro de la llamada no hay nada que esperar: se cierra para no
      // dejar el cupo bloqueado para siempre.
      if (!call) {
        const cerrado = cerrarItem(item, { error: "Vapi ya no reconoce esta llamada." }, campana, ahora);
        campana = { ...campana, items: campana.items.map((i) => (i.id === item.id ? cerrado : i)) };
        cerradas.push(item.id);
        continue;
      }
      if (!llamadaTerminada(call)) {
        // Sigue en curso: solo se asciende de "marcando" a "en_curso".
        if (item.estado === "marcando") {
          const vivo: ItemCampana = { ...item, estado: "en_curso", actualizado: ahora.toISOString() };
          campana = { ...campana, items: campana.items.map((i) => (i.id === item.id ? vivo : i)) };
        }
        continue;
      }
      const duracionSeg =
        call.startedAt && call.endedAt
          ? Math.max(0, Math.round((Date.parse(call.endedAt) - Date.parse(call.startedAt)) / 1000))
          : 0;
      const cerrado = await cerrarConAnalisis(
        campana,
        item,
        {
          transcript: call.transcript,
          duracionSeg,
          costo: typeof call.cost === "number" ? call.cost : undefined,
          endedReason: call.endedReason,
          grabacionUrl: call.recordingUrl,
        },
        ahora,
      );
      campana = { ...campana, items: campana.items.map((i) => (i.id === item.id ? cerrado : i)) };
      cerradas.push(item.id);
    } else {
      // Simulación: la llamada que se lanzó en el tick anterior ya terminó.
      const indice = campana.items.findIndex((i) => i.id === item.id);
      const resultado = resultadoSimulado(indice + item.intentos);
      const deudor = buscarDeudor(item.deudorId);
      // Dos modos de simulación: barato (el análisis viene armado) o completo
      // (se fabrica un transcript y lo lee el modelo de verdad).
      const conIa = IA_EN_SIMULACION();
      const analisisPrecocido =
        deudor && !conIa ? analisisSimulado(deudor, resultado, indice, hoy) : undefined;
      const transcript =
        deudor && conIa ? transcriptSimulado(deudor, resultado, indice, hoy) : undefined;
      const cerrado = await cerrarConAnalisis(
        campana,
        item,
        {
          transcript,
          duracionSeg: duracionSimulada(resultado, indice),
          costo: 0,
          endedReason: resultado === "no_contesto" ? "customer-did-not-answer" : "customer-ended-call",
          analisisPrecocido: analisisPrecocido ?? undefined,
        },
        ahora,
      );
      campana = { ...campana, items: campana.items.map((i) => (i.id === item.id ? cerrado : i)) };
      cerradas.push(item.id);
    }
  }

  // ── 2. Llenar los cupos libres ──
  const tanda = planificarTanda(campana, ahora);
  const lanzadas: string[] = [];

  for (const item of tanda.marcar) {
    const intentos = item.intentos + 1;
    let siguiente: ItemCampana;

    if (real) {
      if (!campana.phoneNumberId) {
        errores.push("La campaña no tiene número de salida asignado.");
        break;
      }
      try {
        const llamada = await lanzarLlamadaVapi({
          assistantId: campana.assistantId,
          phoneNumberId: campana.phoneNumberId,
          numero: item.telefono,
          variables: variablesDe(item.deudorId, hoy),
        });
        siguiente = {
          ...item,
          estado: "marcando",
          intentos,
          callId: llamada.id,
          error: undefined,
          reintentarDespues: undefined,
          actualizado: ahora.toISOString(),
        };
        lanzadas.push(item.id);
      } catch (err) {
        // Un número que la telefonía rechaza no bloquea la campaña: se cierra
        // (o se reprograma) y el cupo queda libre para el siguiente.
        siguiente = cerrarItem(
          { ...item, intentos },
          { error: err instanceof Error ? err.message : "No se pudo marcar." },
          campana,
          ahora,
        );
        errores.push(`${item.nombre}: ${siguiente.error}`);
      }
    } else {
      siguiente = {
        ...item,
        estado: "en_curso",
        intentos,
        callId: `sim-${campana.id}-${item.id}-${intentos}`,
        error: undefined,
        reintentarDespues: undefined,
        actualizado: ahora.toISOString(),
      };
      lanzadas.push(item.id);
    }

    campana = { ...campana, items: campana.items.map((i) => (i.id === item.id ? siguiente : i)) };
  }

  // ── 3. ¿Terminó? ──
  if (campana.estado === "corriendo" && campanaAgotada(campana)) {
    campana = { ...campana, estado: "terminada", terminada: ahora.toISOString() };
  }

  guardarCampana(campana);

  return NextResponse.json({
    ok: true,
    campana: resumirCampana(campana, promesasDeCampana(campana)),
    lanzadas: lanzadas.length,
    cerradas: cerradas.length,
    motivo: tanda.motivo ?? null,
    simulada: !real,
    errores: errores.slice(0, 5),
  });
}
