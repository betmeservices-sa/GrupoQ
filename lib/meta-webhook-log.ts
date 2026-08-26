// Guardar cada aviso de Meta tal cual llega.
//
// Existe porque hoy se perdieron horas mirando logs en vivo para saber si Meta
// había avisado de un mensaje y con qué forma. Los logs se cortan solos y no
// guardan lo anterior. Esto deja el crudo en la base, donde se puede mirar
// después y comparar con lo que entró a la bandeja.
//
// Nunca puede frenar al webhook: si la tabla no está o la base falla, se sigue
// como si nada. Perder el rastro es molesto; perder el mensaje no se permite.

import { getSupabase } from "./supabase";

// Cuando la tabla no existe, no se insiste en cada aviso.
const g = globalThis as unknown as { __metaEventosSinTabla?: boolean };

export async function guardarEventoMeta(objeto: string | undefined, cuerpo: unknown): Promise<void> {
  if (g.__metaEventosSinTabla) return;
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { error } = await sb
      .from("meta_webhook_eventos")
      .insert({ objeto: objeto ?? null, cuerpo });
    if (error) {
      if (/meta_webhook_eventos/.test(error.message)) g.__metaEventosSinTabla = true;
      console.error("[meta-webhook] no se pudo guardar el aviso crudo:", error.message);
    }
  } catch (e) {
    console.error("[meta-webhook] no se pudo guardar el aviso crudo:", e);
  }
}
