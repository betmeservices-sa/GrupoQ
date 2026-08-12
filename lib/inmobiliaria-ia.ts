// La costura para que un modelo lea la nota de voz, con las reglas como piso.
//
// ESTADO HOY: la llave de Anthropic está sin saldo, así que este camino NO se
// puede probar en vivo y viene APAGADO (se prende con INMO_DICTADO_MODELO=1).
// Lo que corre y está cubierto por tests es el extractor de reglas
// (inmobiliaria-dictado). Esto es el enchufe, no el motor.
//
// Cómo se combinan cuando el modelo sí contesta:
//   - Las reglas mandan. Lo que ellas entendieron NO se pisa: cada dato suyo
//     viene con el pedazo de frase que lo produjo, que es la garantía de que
//     nadie inventó nada.
//   - El modelo solo RELLENA huecos, y cada valor de texto que propone tiene
//     que aparecer en lo que el agente dijo. Si el modelo se saca de la manga
//     una colonia que nadie mencionó, se descarta.
// Así, en el peor caso (modelo caído, sin saldo o alucinando), el formulario
// queda igual que hoy y nunca peor.

import Anthropic from "@anthropic-ai/sdk";
import { extraerDeDictado, faltantesDe, normalizar, type CampoAlta, type Extraccion } from "./inmobiliaria-dictado";

export interface ResultadoDictado {
  extraccion: Extraccion;
  fuente: "reglas" | "reglas+modelo";
  aviso: string | null;
}

const MODELO = process.env.AI_MODEL || "claude-haiku-4-5";
const ENCENDIDO = process.env.INMO_DICTADO_MODELO === "1";
const TOPE_MS = 8000;

const INSTRUCCION = `Sos un extractor de datos de bienes raíces de El Salvador. Te paso lo que un agente inmobiliario dictó parado frente a la propiedad.

Devolvé ÚNICAMENTE un JSON con estas claves, sin texto alrededor:
{"operacion":"venta"|"alquiler"|null,"tipo":"casa"|"apartamento"|"terreno"|"local"|null,"precio":number|null,"deposito":number|null,"plazoMinimoMeses":number|null,"zona":string|null,"municipio":string|null,"habitaciones":number|null,"banos":number|null,"parqueos":number|null,"areaConstruccion":number|null,"areaTerreno":number|null,"propietarioNombre":string|null,"propietarioTelefono":string|null}

Reglas:
- Lo que el agente NO dijo va en null. NUNCA supongas ni completes.
- En alquiler el precio es la renta MENSUAL.
- areaConstruccion va en metros cuadrados, areaTerreno en varas cuadradas.
- No traduzcas ni cambies nombres de colonias o municipios.`;

function textoDeRespuesta(msg: Anthropic.Message): string {
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// Un valor de texto solo se acepta si el agente lo dijo. Es la barrera contra
// la colonia inventada.
function loDijo(texto: string, valor: string): boolean {
  return normalizar(texto).includes(normalizar(valor).trim());
}

const NUMERICOS: CampoAlta[] = [
  "precio", "deposito", "plazoMinimoMeses", "habitaciones", "banos", "parqueos",
  "areaConstruccion", "areaTerreno",
];

const TEXTOS: CampoAlta[] = ["zona", "municipio", "propietarioNombre", "propietarioTelefono"];

export function combinar(base: Extraccion, crudo: Record<string, unknown>, texto: string): Extraccion {
  const out: Extraccion = { ...base };
  const poner = (campo: CampoAlta, valor: unknown) => {
    if ((out as unknown as Record<string, unknown>)[campo] !== undefined) return; // las reglas mandan
    (out as unknown as Record<string, unknown>)[campo] = { valor, dicho: "lo entendió el modelo" };
  };

  for (const campo of ["operacion", "tipo"] as const) {
    const v = crudo[campo];
    if (typeof v === "string" && v) poner(campo, v);
  }
  for (const campo of NUMERICOS) {
    const v = crudo[campo];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) poner(campo, v);
  }
  for (const campo of TEXTOS) {
    const v = crudo[campo];
    if (typeof v === "string" && v.trim().length > 1 && loDijo(texto, v)) poner(campo, v.trim());
  }
  out.faltantes = faltantesDe(out);
  return out;
}

export async function interpretarDictado(texto: string): Promise<ResultadoDictado> {
  const base = extraerDeDictado(texto);
  if (!ENCENDIDO || !process.env.ANTHROPIC_API_KEY || !texto.trim()) {
    return { extraccion: base, fuente: "reglas", aviso: null };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create(
      {
        model: MODELO,
        max_tokens: 700,
        system: INSTRUCCION,
        messages: [{ role: "user", content: texto }],
      },
      { signal: AbortSignal.timeout(TOPE_MS) },
    );
    const json = textoDeRespuesta(msg).replace(/^```(?:json)?|```$/g, "").trim();
    const crudo = JSON.parse(json) as Record<string, unknown>;
    return { extraccion: combinar(base, crudo, texto), fuente: "reglas+modelo", aviso: null };
  } catch (e) {
    // Sin saldo, sin red o con una respuesta rara: el formulario igual se llena
    // con lo que entendieron las reglas.
    const detalle = e instanceof Error ? e.message : "no se pudo consultar";
    console.warn("[inmobiliaria-ia] el modelo no contestó:", detalle);
    return { extraccion: base, fuente: "reglas", aviso: "El modelo no contestó. Se usó el lector de siempre." };
  }
}
