// Transcripción de las notas de voz de WhatsApp, con la Gemini API. SOLO SERVIDOR.
//
// ── POR QUÉ UN MODELO DISTINTO AL DEL AGENTE ──
// El agente responde con Claude; para pasar audio a texto se usa Gemini porque
// acepta el OGG/Opus de WhatsApp tal cual, sin transcodificar, y cuesta una
// fracción. La transcripción es un paso PREVIO: lo que le llega al agente es
// texto, igual que si el huésped lo hubiera escrito.
//
// ── MEDIDO CONTRA AUDIO REAL (2026-08-19) ──
// Nota de 11.4 s en OGG/Opus mono 48 kHz, la misma forma que manda WhatsApp:
//   gemini-3.5-flash-lite   0.9 s   308 tokens entrada / 34 salida
//   gemini-3.6-flash        2.4 s   los mismos tokens, el doble de precio
// Las dos transcribieron perfecto, con acentos y todo, incluso con la versión
// sucia (ruido rosa, banda telefónica, 16 kbps). Se usa la lite: es más rápida,
// cuesta la mitad y en esta tarea da el mismo resultado.
//
// Si la transcripción falla, NO se rompe nada: el mensaje queda como "[audio]"
// y lo atiende una persona, que es exactamente lo que pasaba antes.

import { abrirMediaWa } from "./wa-media";
import { TENANTS } from "./tenants";
import type { TenantId } from "./tenants/types";

const MODELO = process.env.GEMINI_MODEL_AUDIO || "gemini-3.5-flash-lite";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Formatos de audio que acepta Gemini. WhatsApp manda audio/ogg (Opus) en las
// notas de voz y audio/mpeg cuando reenvían un archivo.
const MIMES = ["audio/ogg", "audio/mpeg", "audio/mp3", "audio/wav", "audio/aac", "audio/flac"];

/**
 * Tope de tamaño. El audio viaja en base64 (crece ~33%) dentro del cuerpo del
 * pedido. Una nota de voz de un minuto pesa unos 100 KB, así que 8 MB deja
 * pasar hasta audios larguísimos y corta antes de que el pedido reviente.
 */
const MAX_BYTES = 8 * 1024 * 1024;

const PROMPT =
  "Transcribe literalmente esta nota de voz. Devuelve SOLO la transcripción, " +
  "sin comillas, sin comentarios y sin describir el audio. Respeta el idioma " +
  "en que habla la persona. Si no se entiende nada, responde exactamente: SIN_AUDIBLE";

/**
 * Los nombres propios del cliente, para que la transcripción no los invente.
 *
 * Esto salió de un caso real: el huésped dijo "Yalí, Playa El Sunzal" en una
 * nota de voz y llegó escrito "Jalip Playel Sunsal". El modelo no tiene por qué
 * conocer tres hoteles de una playa de El Salvador, pero con la lista delante
 * los escribe bien, y de ahí en adelante todo lo que depende de reconocer la
 * sede funciona.
 */
export function vocabularioDeTenant(tenantId?: TenantId): string[] {
  const t = tenantId && TENANTS[tenantId] ? TENANTS[tenantId] : null;
  if (!t) return [];
  const sedes = t.sucursales?.opciones.map((o) => o.nombre) ?? [];
  return [...new Set([...sedes, ...(t.ai.vocabulario ?? [])])];
}

function promptCon(vocabulario: string[]): string {
  if (vocabulario.length === 0) return PROMPT;
  return `${PROMPT}

NOMBRES PROPIOS que pueden aparecer y que debes escribir EXACTAMENTE así: ${vocabulario.join(", ")}. Si oyes algo parecido a uno de estos, escríbelo como está en la lista.`;
}

export interface Transcripcion {
  texto: string;
  modelo: string;
  ms: number;
  tokensEntrada: number;
  tokensSalida: number;
}

export function hayTranscripcion(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Baja la nota de voz de WhatsApp y la pasa a texto. Devuelve null cuando no se
 * pudo (sin llave, formato raro, pesa de más, el modelo no entendió nada o
 * falló la red). Nunca lanza: quien llama sigue su curso con "[audio]".
 */
export async function transcribirAudioWa(
  mediaId: string,
  tenantId?: TenantId,
): Promise<Transcripcion | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  try {
    const media = await abrirMediaWa(mediaId);
    if (!media.ok) {
      console.error("transcripción: no se pudo bajar el audio:", media.error);
      return null;
    }
    const mime = media.mime.split(";")[0].trim().toLowerCase();
    const buf = Buffer.from(await media.res.arrayBuffer());
    return await transcribirAudio(buf, mime, tenantId);
  } catch (e) {
    console.error("transcripción: falló", e);
    return null;
  }
}

/**
 * El paso que habla con Gemini, separado de la descarga.
 *
 * Va aparte para poder medir la transcripción con archivos locales (ver
 * scripts/carga-masiva.ts) sin inventar un media_id de Meta: el banco de pruebas
 * corre EXACTAMENTE este código, no una copia parecida.
 */
export async function transcribirAudio(
  buf: Buffer,
  mimeCrudo: string,
  tenantId?: TenantId,
): Promise<Transcripcion | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  try {
    const mime = mimeCrudo.split(";")[0].trim().toLowerCase();
    if (!MIMES.includes(mime)) {
      console.error("transcripción: formato no soportado", mime);
      return null;
    }
    if (buf.byteLength > MAX_BYTES) {
      console.error("transcripción: el audio pesa demasiado", buf.byteLength);
      return null;
    }

    const t0 = Date.now();
    const res = await fetch(`${BASE}/${MODELO}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptCon(vocabularioDeTenant(tenantId)) },
              { inline_data: { mime_type: mime, data: buf.toString("base64") } },
            ],
          },
        ],
      }),
    });
    const ms = Date.now() - t0;
    const json = (await res.json().catch(() => ({}))) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
      error?: { message?: string };
    };
    if (!res.ok) {
      console.error("transcripción:", res.status, json.error?.message ?? "sin detalle");
      return null;
    }

    const texto = (json.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("")
      .trim();
    // El modelo devuelve esta marca cuando el audio no se entiende. Mejor eso
    // que inventarle palabras a un huésped.
    if (!texto || texto === "SIN_AUDIBLE") return null;

    return {
      texto,
      modelo: MODELO,
      ms,
      tokensEntrada: json.usageMetadata?.promptTokenCount ?? 0,
      tokensSalida: json.usageMetadata?.candidatesTokenCount ?? 0,
    };
  } catch (e) {
    console.error("transcripción: falló", e);
    return null;
  }
}

/**
 * Cómo se guarda una nota de voz ya transcrita. Se deja la marca "[audio]"
 * adelante a propósito: en la bandeja se tiene que ver que el huésped MANDÓ UN
 * AUDIO, no que escribió eso. La misma línea es la que lee el agente.
 */
export function textoDeAudio(transcripcion: string): string {
  return `[audio] ${transcripcion}`;
}
