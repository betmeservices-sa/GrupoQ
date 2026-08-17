// Simulación de llamadas para cuando NO hay telefonía conectada.
//
// Sin VAPI_PRIVATE_KEY el módulo tiene que seguir contando la misma historia:
// se sube una base, arranca la campaña, las llamadas van saliendo de N en N y
// las fichas se mueven solas. Esto produce esos resultados.
//
// Dos decisiones que importan:
// 1. Es DETERMINISTA (depende del índice del contacto, no del azar): el demo se
//    ve igual cada vez y se puede probar.
// 2. La mezcla de resultados es la de una cartera real, no una optimista.
//    Casi la mitad de las llamadas de cobranza no contesta, y un demo donde
//    todos prometen pagar no le sirve a nadie para decidir.
//
// La ficha se mueve con la MISMA función pura que usa el camino real
// (aplicarAnalisis), así que lo que se ve en simulación es lo que va a pasar
// cuando entre la telefonía. Lo único que no corre es el modelo.

import type { AnalisisLlamada } from "./cobros-ia";
import type { Deudor, ResultadoLlamada } from "./cobros-tipos";

// Distribución observable en cobranza telefónica: la mayoría no contesta.
// Los pesos suman 100 y se recorren en orden.
const MEZCLA: Array<[ResultadoLlamada, number]> = [
  ["no_contesto", 45],
  ["promesa_pago", 15],
  ["ya_pago", 7],
  ["no_puede_pagar", 7],
  ["quiere_negociar", 6],
  ["colgo", 5],
  ["pidio_recontacto", 5],
  ["contesto_tercero", 4],
  ["numero_equivocado", 3],
  ["disputa", 2],
  ["solicita_no_llamar", 1],
];

/** Reparte de forma estable: el mismo índice siempre da el mismo resultado. */
export function resultadoSimulado(indice: number): ResultadoLlamada {
  // Multiplicar por un primo desordena la secuencia sin volverla aleatoria, así
  // no salen los 45 "no contestó" seguidos al principio de la lista.
  const p = (indice * 37) % 100;
  let acumulado = 0;
  for (const [resultado, peso] of MEZCLA) {
    acumulado += peso;
    if (p < acumulado) return resultado;
  }
  return "no_contesto";
}

/** Duración plausible según cómo terminó. Un "no contestó" no dura 3 minutos. */
export function duracionSimulada(resultado: ResultadoLlamada, indice: number): number {
  const jitter = (indice * 13) % 30;
  switch (resultado) {
    case "no_contesto":
      return 0;
    case "colgo":
      return 8 + (jitter % 10);
    case "numero_equivocado":
      return 18 + (jitter % 12);
    case "contesto_tercero":
      return 25 + (jitter % 15);
    case "pidio_recontacto":
      return 40 + (jitter % 20);
    case "ya_pago":
      return 55 + jitter;
    case "solicita_no_llamar":
      return 35 + (jitter % 15);
    default:
      return 95 + jitter * 2;
  }
}

function dinero(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function enDias(hoy: string, n: number): string {
  const t = Date.parse(`${hoy}T12:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

// Lo que diría el cliente en cada caso. Corto y en habla real: es lo que el
// modelo tiene que ser capaz de clasificar, no un guion de ejemplo perfecto.
const REPLICA: Partial<Record<ResultadoLlamada, string>> = {
  promesa_pago: "Fijese que si, pero a mi me pagan hasta el {{fecha}}. Ese dia le pago los {{monto}} completos.",
  ya_pago: "Yo ya pague eso, lo hice por la banca en linea la semana pasada. Revise bien porque ya esta cancelado.",
  pago_parcial: "Mire, completo no puedo. Le puedo abonar la mitad ahorita y el resto a fin de mes.",
  no_puede_pagar: "La verdad no puedo. Me quede sin trabajo y no tengo de donde sacar ahorita.",
  quiere_negociar: "Yo quiero arreglar, pero necesito que me bajen la cuota. Asi como esta no me da.",
  disputa: "Es que ahi me estan cobrando un seguro que yo nunca contrate. Yo no pago eso hasta que me lo aclaren.",
  numero_equivocado: "No, aqui no vive ninguna persona con ese nombre. Tiene el numero equivocado.",
  contesto_tercero: "El no esta, soy la esposa. El llega despues de las cinco.",
  pidio_recontacto: "Ahorita ando manejando, me llama mas tarde por favor.",
  solicita_no_llamar: "Ya no me llamen mas a este numero. Si quieren algo me lo mandan por escrito.",
  colgo: "No me interesa.",
};

/**
 * Transcripción simulada de la llamada, con el formato del transcript real de
 * Vapi. Solo se usa cuando COBROS_IA_EN_SIMULACION está encendido: sirve para
 * probar el análisis con el modelo de verdad, sin telefonía.
 */
export function transcriptSimulado(
  deudor: Pick<Deudor, "nombre" | "montoVencido" | "producto">,
  resultado: ResultadoLlamada,
  indice: number,
  hoy: string,
): string | undefined {
  const replica = REPLICA[resultado];
  if (!replica) return undefined;

  const dias = 2 + (indice % 10);
  const cuerpo = replica
    .replace("{{fecha}}", enDias(hoy, dias))
    .replace("{{monto}}", `${dinero(deudor.montoVencido)} dolares`);

  return [
    `Agente: Buenos dias, le saluda Camila, del area de servicio al cliente de Banco Promerica. Hablo con ${deudor.nombre}?`,
    resultado === "numero_equivocado" || resultado === "contesto_tercero"
      ? `Cliente: ${cuerpo}`
      : "Cliente: Si, con el habla.",
    ...(resultado === "numero_equivocado" || resultado === "contesto_tercero"
      ? ["Agente: Disculpe la molestia. Que tenga buen dia."]
      : [
          "Agente: Por seguridad, me confirma los ultimos cuatro digitos de su documento?",
          "Cliente: Si, cuatro dos siete siete.",
          `Agente: Gracias. Le llamo por su ${deudor.producto}, que tiene ${dinero(deudor.montoVencido)} dolares pendientes. Me ayuda a resolverlo hoy?`,
          `Cliente: ${cuerpo}`,
          "Agente: Entendido. Gracias por su tiempo, que este bien.",
        ]),
  ].join("\n");
}

/**
 * El análisis que habría devuelto el modelo, armado a mano.
 *
 * Devuelve null cuando la llamada no conectó: ahí no hay nada que analizar y el
 * camino real tampoco llamaría al modelo.
 */
export function analisisSimulado(
  deudor: Pick<Deudor, "nombre" | "montoVencido" | "cuotaMensual">,
  resultado: ResultadoLlamada,
  indice: number,
  hoy: string,
): AnalisisLlamada | null {
  if (resultado === "no_contesto") return null;

  const nombre = deudor.nombre.split(" ")[0];
  const dias = 2 + (indice % 10);

  switch (resultado) {
    case "promesa_pago":
      return {
        resultado,
        resumen: `Se comprometió a pagar $${dinero(deudor.montoVencido)} el ${enDias(hoy, dias)}, cuando le depositan.`,
        sentimiento: "cooperativo",
        riesgo: "bajo",
        promesa: { monto: deudor.montoVencido, fecha: enDias(hoy, dias) },
        proximaAccion: { tipo: "esperar_pago", cuando: enDias(hoy, dias) },
      };
    case "ya_pago":
      return {
        resultado,
        resumen: `Dice que ya pagó por banca en línea. Queda pendiente que el banco lo verifique.`,
        sentimiento: "neutral",
        riesgo: "bajo",
        proximaAccion: { tipo: "cerrar", nota: "Verificar el pago en el core." },
      };
    case "pago_parcial":
      return {
        resultado,
        resumen: `Puede abonar $${dinero(deudor.cuotaMensual)} ahora y completar el resto a fin de mes.`,
        sentimiento: "cooperativo",
        riesgo: "medio",
        promesa: { monto: deudor.cuotaMensual, fecha: enDias(hoy, dias) },
        proximaAccion: { tipo: "recontactar", cuando: enDias(hoy, dias + 10) },
      };
    case "no_puede_pagar":
      return {
        resultado,
        resumen: `Dice que este mes no puede pagar nada. No dio fecha ni monto alternativo.`,
        sentimiento: "evasivo",
        riesgo: "alto",
        proximaAccion: { tipo: "enviar_convenio", cuando: enDias(hoy, 7) },
      };
    case "quiere_negociar":
      return {
        resultado,
        resumen: `Pidió opciones de refinanciamiento. Solo puede con una cuota más baja.`,
        sentimiento: "cooperativo",
        riesgo: "medio",
        proximaAccion: { tipo: "enviar_convenio", cuando: enDias(hoy, 3) },
      };
    case "disputa":
      return {
        resultado,
        resumen: `Reclama un cargo que dice no reconocer. Pidió estado de cuenta antes de pagar.`,
        sentimiento: "molesto",
        riesgo: "alto",
        proximaAccion: { tipo: "escalar_humano" },
        alerta: { motivo: "Reclamo de cobro abierto: no volver a llamar hasta resolverlo." },
      };
    case "numero_equivocado":
      return {
        resultado,
        resumen: `El número ya no le pertenece a ${nombre}. Contestó otra persona.`,
        sentimiento: "neutral",
        riesgo: "alto",
        proximaAccion: { tipo: "sacar_de_campana" },
      };
    case "contesto_tercero":
      return {
        resultado,
        resumen: `Contestó un familiar. No se dio información. Dijo que el titular llega por la tarde.`,
        sentimiento: "neutral",
        riesgo: "medio",
        proximaAccion: { tipo: "recontactar", cuando: enDias(hoy, 1) },
      };
    case "pidio_recontacto":
      return {
        resultado,
        resumen: `Estaba ocupado. Pidió que le llamen en la tarde.`,
        sentimiento: "neutral",
        riesgo: "medio",
        proximaAccion: { tipo: "recontactar", cuando: enDias(hoy, 1) },
      };
    case "solicita_no_llamar":
      return {
        resultado,
        resumen: `Pidió que no lo vuelvan a llamar. Solo acepta comunicación por escrito.`,
        sentimiento: "molesto",
        riesgo: "alto",
        proximaAccion: { tipo: "sacar_de_campana" },
        alerta: { motivo: "El cliente pidió que no lo contacten por teléfono." },
      };
    case "colgo":
      return {
        resultado,
        resumen: `Colgó apenas se identificó el banco.`,
        sentimiento: "molesto",
        riesgo: "alto",
        proximaAccion: { tipo: "recontactar", cuando: enDias(hoy, 2) },
      };
    default:
      return {
        resultado: "sin_clasificar",
        resumen: "Llamada sin resultado claro.",
        sentimiento: "neutral",
        riesgo: "medio",
        proximaAccion: { tipo: "recontactar" },
      };
  }
}
