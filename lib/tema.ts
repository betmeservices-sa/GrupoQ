// De qué habla un mensaje entrante, en una palabra.
//
// Sirve para dos cosas: que el panel pueda decir "hoy preguntaron 14 veces por
// el Day Pass", y para que quien atiende vea de un vistazo qué es cada cola.
// Es por palabras clave, sin llamar al modelo: cuesta cero, corre en el
// webhook y acierta en lo que importa (las cinco o seis preguntas que se
// repiten todo el día). Lo que no calza queda como "otro", que es honesto.

export type Tema =
  | "day_pass"
  | "reserva"
  | "precio"
  | "horarios"
  | "membresia"
  | "ubicacion"
  | "reclamo"
  | "menu"
  | "otro";

export const TEMAS: { id: Tema; nombre: string }[] = [
  { id: "day_pass", nombre: "Day Pass" },
  { id: "reserva", nombre: "Reservas" },
  { id: "precio", nombre: "Precios" },
  { id: "horarios", nombre: "Horarios" },
  { id: "membresia", nombre: "Membresía" },
  { id: "ubicacion", nombre: "Ubicación" },
  { id: "menu", nombre: "Menú y restaurante" },
  { id: "reclamo", nombre: "Reclamos" },
  { id: "otro", nombre: "Otro" },
];

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// El orden importa: se evalúa de arriba hacia abajo y gana la primera. Un
// reclamo con la palabra "day pass" adentro es un reclamo; una pregunta de
// precio del day pass es day pass.
const REGLAS: { tema: Tema; re: RegExp }[] = [
  { tema: "reclamo", re: /\b(reclamo|queja|pesim|mal servicio|discrimin|estafa|mentira|nunca mas|no vuelvo|decepcion|denunci|robo|robaron|sacaron|maltrat)/ },
  { tema: "membresia", re: /\b(membres|membrec|socio|socia\b|afiliac|black elite|elite)/ },
  { tema: "day_pass", re: /\b(day ?pass|daypass|de ?pass|pasadia|pase del dia|pasar el dia|por el dia|solo el dia)/ },
  { tema: "precio", re: /\b(precio|cuanto|cuesta|costo|tarifa|valor|vale\b|cobran|\$\s?\d)/ },
  { tema: "horarios", re: /\b(horario|a que hora|hasta que hora|desde que hora|abren|cierran|check ?in|check ?out|entrada|salida)\b/ },
  { tema: "ubicacion", re: /\b(donde queda|donde esta|donde estan|ubicad|ubicacion|direccion|como llego|llegar|mapa|localizacion|locacion|que playa|kilometro)/ },
  { tema: "reserva", re: /\b(reserv|disponib|habitacion|cuarto|bungalow|hospedaj|noche|alojamiento|quedarnos|quedarme|cabana|cabaña|cotiz)/ },
  { tema: "menu", re: /\b(menu|restaurante|comida|platillo|desayuno|almuerzo|cena|bebida|punche|mariscos)/ },
];

/** El tema de un texto. "otro" cuando no calza con ninguna regla. */
export function temaDe(texto: string | null | undefined): Tema {
  const t = normalizar(texto ?? "");
  if (!t.trim()) return "otro";
  for (const r of REGLAS) if (r.re.test(t)) return r.tema;
  return "otro";
}

export function nombreDeTema(id: string | null | undefined): string {
  return TEMAS.find((t) => t.id === id)?.nombre ?? "Otro";
}
