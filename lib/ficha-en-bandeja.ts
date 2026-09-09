// Cruzar la bandeja con la ficha del contacto, por teléfono.
//
// POR QUÉ. En Contactos la persona tiene nombre, correo y notas; en la bandeja
// aparecía "7539-1721". Son dos almacenes distintos: la bandeja arma su
// contacto con lo que manda Meta (el nombre del perfil de WhatsApp, que muchas
// veces no existe), y la ficha vive en `wa_contacts`, que es lo que el equipo
// llena a mano y lo que trae el CSV. Nadie los cruzaba.
//
// EL TELÉFONO NO ESTÁ GUARDADO IGUAL EN LOS DOS LADOS, y ese es el detalle que
// hace falta acertar: la bandeja usa el número completo como lo manda Meta
// (50375391721) y las fichas que entran por el CSV se guardan con los últimos
// ocho dígitos (75391721), que es la llave de la memoria del agente de voz.
// Comparar los textos tal cual no cruza nada. Se comparan los últimos ocho.

export interface FichaContacto {
  telefono: string;
  nombre?: string;
  apellido?: string;
  correo?: string;
  notas?: string;
  tags?: string[];
}

/**
 * La llave con que se compara un teléfono: sus últimos ocho dígitos.
 *
 * En El Salvador el número son ocho dígitos y el 503 es el país, así que los
 * últimos ocho identifican a la persona venga como venga escrito: +503 7539
 * 1721, 50375391721 o 75391721 son la misma.
 */
export function claveTelefono(telefono?: string | null): string {
  const d = (telefono ?? "").replace(/\D+/g, "");
  return d.length > 8 ? d.slice(-8) : d;
}

/** Las fichas indexadas por esa llave, para buscarlas de un vistazo. */
export function indexarFichas(fichas: readonly FichaContacto[]): Map<string, FichaContacto> {
  const m = new Map<string, FichaContacto>();
  for (const f of fichas) {
    const k = claveTelefono(f.telefono);
    if (!k) continue;
    // Si hay dos con el mismo número, gana la que tenga nombre: una ficha sin
    // nombre no aporta nada y taparía a la que sí lo tiene.
    const previa = m.get(k);
    if (!previa || (!previa.nombre?.trim() && f.nombre?.trim())) m.set(k, f);
  }
  return m;
}

/** Nombre y apellido, o vacío si la ficha no trae nombre. */
export function nombreDeFicha(f: FichaContacto | undefined): string {
  if (!f) return "";
  return [f.nombre, f.apellido].map((x) => (x ?? "").trim()).filter(Boolean).join(" ");
}

/** Un contacto de la bandeja, en lo que a esto le interesa. */
export interface ContactoBandeja {
  nombre: string;
  telefono?: string;
  correo?: string;
  notas?: string;
  tags?: string[];
}

/**
 * ¿El "nombre" que muestra la bandeja es en realidad el número?
 *
 * Cuando Meta no manda nombre de perfil, la bandeja pone el teléfono con
 * guion ("7539-1721"). Eso no es un nombre y la ficha lo debe reemplazar. Pero
 * si Meta SÍ mandó un nombre de perfil y la ficha no tiene, se queda el de
 * Meta: es preferible a un número.
 */
export function esSoloElNumero(nombre: string, telefono?: string): boolean {
  const n = (nombre ?? "").replace(/\D+/g, "");
  if (!n) return false;
  // Sin letras: es un número escrito de alguna forma.
  if (/\p{L}/u.test(nombre)) return false;
  return telefono ? claveTelefono(n) === claveTelefono(telefono) : true;
}

/**
 * El contacto de la bandeja con lo que sepa la ficha.
 *
 * La ficha manda en el nombre solo si tiene uno; en lo demás rellena lo que
 * falte y NO pisa lo que la bandeja ya traía. El correo que la persona escribió
 * en el chat vale tanto como el que alguien tecleó en Contactos, y quien lo
 * puso primero suele tenerlo más fresco.
 */
export function conFicha<T extends ContactoBandeja>(
  contacto: T,
  fichas: Map<string, FichaContacto>,
): T {
  const f = fichas.get(claveTelefono(contacto.telefono));
  if (!f) return contacto;

  const deLaFicha = nombreDeFicha(f);
  const nombre =
    deLaFicha && esSoloElNumero(contacto.nombre, contacto.telefono) ? deLaFicha : contacto.nombre;

  const notas = contacto.notas?.trim() || f.notas?.trim() || undefined;
  const correo = contacto.correo?.trim() || f.correo?.trim() || undefined;
  const tags = contacto.tags?.length ? contacto.tags : f.tags?.length ? f.tags : undefined;

  if (nombre === contacto.nombre && notas === contacto.notas && correo === contacto.correo && tags === contacto.tags) {
    // Nada que agregar: se devuelve el mismo objeto para no romper las
    // comparaciones por referencia que hace React al decidir si redibuja.
    return contacto;
  }
  return { ...contacto, nombre, ...(notas ? { notas } : {}), ...(correo ? { correo } : {}), ...(tags ? { tags } : {}) };
}
