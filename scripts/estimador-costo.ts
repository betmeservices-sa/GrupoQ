/**
 * Estimador de costo por cliente, construido sobre lo MEDIDO en producción.
 *
 * Las constantes de abajo no son supuestos: salen de medicion/live-turnos.csv,
 * 32 turnos reales contra demo.miagentia.com. Si se vuelve a correr
 * `npm run costo:live` con más turnos, hay que actualizarlas acá.
 *
 * Lo único extrapolado es el salto a Sonnet y Opus: esos modelos van en un nivel
 * de resolución más alto, donde la MISMA foto gasta más tokens. El factor sale
 * del análisis de 600 imágenes reales (medicion/COSTO-IMAGENES.md).
 *
 * Uso:  npm run costo:estimar
 */
import fs from "node:fs";
import path from "node:path";
import { tarifaDe } from "../lib/tokens-precios";

// ── Lo medido (32 turnos en producción, Haiku 4.5) ────────────────────────────

const MEDIDO = {
  turnos: 32,
  texto: { entrada: 4166, salida: 113 },
  imagen: { entrada: 4976, salida: 133, tokensFoto: 866 },
  /** Guion del tenant (1368) + definición de las herramientas (673). */
  prefijoFijo: 2041,
};

/**
 * Cuánto más pesa la misma foto en los modelos de alta resolución.
 * De 600 imágenes reales: 1041 tokens en estándar contra 1735 en alta.
 */
const FACTOR_ALTA_RESOLUCION = 1735 / 1041;

const ALTA_RESOLUCION = /opus-5|sonnet-5|opus-4-(7|8)|fable-5/;

// ── Escenarios ────────────────────────────────────────────────────────────────

interface Escenario {
  nombre: string;
  convDia: number;
  turnosPorConv: number;
  pctFotos: number;
}

const ESCENARIOS: Escenario[] = [
  { nombre: "Negocio chico", convDia: 5, turnosPorConv: 6, pctFotos: 10 },
  { nombre: "Negocio mediano", convDia: 20, turnosPorConv: 7, pctFotos: 15 },
  { nombre: "Negocio con volumen", convDia: 60, turnosPorConv: 8, pctFotos: 20 },
  { nombre: "Alto volumen", convDia: 200, turnosPorConv: 8, pctFotos: 25 },
];

const DIAS_MES = 30;

function costoTurno(modelo: string, conFoto: boolean, cacheado: boolean) {
  const t = tarifaDe(modelo);
  if (!t) return 0;
  const alta = ALTA_RESOLUCION.test(modelo);

  const base = conFoto ? MEDIDO.imagen : MEDIDO.texto;
  // En alta resolución la foto pesa más; el resto del prompt no cambia.
  const extraFoto = conFoto && alta ? MEDIDO.imagen.tokensFoto * (FACTOR_ALTA_RESOLUCION - 1) : 0;
  const entrada = base.entrada + extraFoto;

  if (!cacheado) {
    return entrada * (t.input / 1e6) + base.salida * (t.output / 1e6);
  }
  // Con caché: el prefijo fijo se escribe una vez por conversación (1.25x) y se
  // lee en los demás turnos (0.1x). Se asume una conversación de 7 turnos.
  const TURNOS = 7;
  const prefijoConCache = MEDIDO.prefijoFijo * ((1.25 + 0.1 * (TURNOS - 1)) / TURNOS);
  const resto = entrada - MEDIDO.prefijoFijo;
  return (resto + prefijoConCache) * (t.input / 1e6) + base.salida * (t.output / 1e6);
}

const d = (n: number, k = 2) => `$${n.toFixed(k)}`;

function main() {
  const L: string[] = [];
  const P = (s = "") => L.push(s);

  P("# Cuánto cuesta la IA por cliente al mes");
  P("");
  P(`Construido sobre **${MEDIDO.turnos} turnos medidos en producción**, no sobre supuestos.`);
  P("Es solo el costo del modelo. Lo que cobra Meta por conversación de WhatsApp va");
  P("aparte y cambia por país y por tipo de conversación.");
  P("");

  P("## El costo de un turno");
  P("");
  P("| Modelo | Texto | Con foto | Texto (cacheado) | Con foto (cacheado) |");
  P("|---|---|---|---|---|");
  for (const m of ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"]) {
    P(
      `| \`${m}\` | ${d(costoTurno(m, false, false), 5)} | ${d(costoTurno(m, true, false), 5)} ` +
        `| ${d(costoTurno(m, false, true), 5)} | ${d(costoTurno(m, true, true), 5)} |`,
    );
  }
  P("");
  P("Cacheado quiere decir con `cache_control` sobre el guion y las herramientas,");
  P("que hoy NO está puesto. Los 2041 tokens de ese prefijo son idénticos en cada");
  P("llamada del mismo cliente.");
  P("");

  P("## Por tamaño de negocio, al mes");
  P("");
  P("| Escenario | Conversaciones/día | Turnos/mes | Hoy | Con caché | Se ahorra |");
  P("|---|---|---|---|---|---|");
  const modelo = "claude-haiku-4-5";
  for (const e of ESCENARIOS) {
    const turnosMes = e.convDia * e.turnosPorConv * DIAS_MES;
    const conFoto = turnosMes * (e.pctFotos / 100);
    const soloTexto = turnosMes - conFoto;
    const hoy =
      soloTexto * costoTurno(modelo, false, false) + conFoto * costoTurno(modelo, true, false);
    const cache =
      soloTexto * costoTurno(modelo, false, true) + conFoto * costoTurno(modelo, true, true);
    P(
      `| ${e.nombre} | ${e.convDia} | ${turnosMes.toLocaleString("es")} | ${d(hoy)} | ${d(cache)} | ${d(hoy - cache)} |`,
    );
  }
  P("");
  P(`Con ${DIAS_MES} días al mes y el porcentaje de fotos que se indica en cada fila.`);
  P("");

  P("## El mismo negocio, cambiando de modelo");
  P("");
  const e = ESCENARIOS[1];
  const turnosMes = e.convDia * e.turnosPorConv * DIAS_MES;
  const conFoto = turnosMes * (e.pctFotos / 100);
  const soloTexto = turnosMes - conFoto;
  P(`Tomando **${e.nombre}** (${turnosMes.toLocaleString("es")} turnos al mes, ${e.pctFotos}% con foto):`);
  P("");
  P("| Modelo | Al mes | Contra Haiku |");
  P("|---|---|---|");
  const refer = soloTexto * costoTurno("claude-haiku-4-5", false, false) +
    conFoto * costoTurno("claude-haiku-4-5", true, false);
  for (const m of ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"]) {
    const c = soloTexto * costoTurno(m, false, false) + conFoto * costoTurno(m, true, false);
    P(`| \`${m}\` | ${d(c)} | ${m.includes("haiku") ? "—" : `${(c / refer).toFixed(1)}x`} |`);
  }
  P("");

  P("## Cuánto pesa que manden fotos");
  P("");
  P(`Una foto suma **${d(costoTurno(modelo, true, false) - costoTurno(modelo, false, false), 6)}** sobre un turno de texto.`);
  P("Ese es el número que importa cuando alguien pregunta si conviene dejar que");
  P("manden imágenes.");
  P("");
  P("| Si de cada 100 mensajes traen foto | Sobrecosto mensual (negocio mediano) |");
  P("|---|---|");
  for (const pct of [0, 10, 25, 50, 100]) {
    const cf = turnosMes * (pct / 100);
    const st = turnosMes - cf;
    const c = st * costoTurno(modelo, false, false) + cf * costoTurno(modelo, true, false);
    const base0 = turnosMes * costoTurno(modelo, false, false);
    P(`| ${pct}% | ${d(c)} (${pct === 0 ? "base" : `+${d(c - base0)}`}) |`);
  }
  P("");
  P("Aunque TODOS los mensajes trajeran foto, el costo sube menos de un 20%. Las");
  P("fotos no son el problema: el problema es el prefijo que se repite en cada turno.");
  P("");

  P("## Lo que hay que tener claro");
  P("");
  P("- Estos números son del modelo, nada más. Meta cobra su parte por conversación.");
  P("- Salen de 32 turnos. Son suficientes para ordenar de magnitud, no para");
  P("  facturarle a un cliente al centavo. Con más turnos medidos, se afinan.");
  P("- El costo por turno CRECE con la conversación, porque el historial viaja");
  P("  entero. Un hilo de 20 mensajes cuesta más por turno que uno de 3.");
  P("- El tope de 10 mensajes por conversación es, además de una baranda de");
  P("  producto, un techo de costo por conversación.");

  const md = L.join("\n");
  const dir = path.join(process.cwd(), "medicion");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "ESTIMACION.md"), md, "utf8");
  console.log(md);
}

main();
