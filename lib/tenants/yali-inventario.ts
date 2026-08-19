// ============================================================================
// INVENTARIO DE YALI HOSPITALITY  ·  ÚNICO ARCHIVO QUE HAY QUE EDITAR
// ============================================================================
//
// Tres hoteles bajo la misma administración (Sunzal Beach Club). Los nombres,
// las ubicaciones y los tipos de habitación de abajo salieron del sitio del
// cliente (yalihospitality.com), no de una suposición.
//
// LAS TARIFAS SON DE DEMOSTRACIÓN. El hotel no publica precios en su sitio, así
// que cada tipo lleva `tarifaDemo` y la bandera `tarifasConfirmadas` de la sede
// está en false. Mientras esté en false:
//   1. el panel del dashboard marca las cifras como demostración;
//   2. el agente de WhatsApp cotiza con ellas, pero avisa que el equipo
//      confirma el precio final.
// Cuando el hotel dé sus tarifas (o cuando se conecte su Cloudbeds), se cambian
// aquí y se pone `tarifasConfirmadas: true`. Nada más hay que tocar.
//
// El día que Cloudbeds entregue credenciales, este archivo pasa a ser el
// respaldo: lib/yali-pms.ts lee primero el PMS y solo cae aquí si no hay llave.
// ============================================================================

export interface HabitacionYali {
  id: string; // llave estable con la que se guarda una reserva (no cambiarla)
  nombre: string; // como se le muestra al huésped, igual que en el sitio
  descripcion: string; // textual del sitio del hotel
  maxHuespedes: number; // deducido de las camas que declara el sitio
  unidades: number; // cuántas hay de ese tipo (dato de demostración)
  tarifaDemo: number; // USD por noche, DEMOSTRACIÓN (ver cabecera)
}

export interface SedeYali {
  // Calza con el id de lib/tenants/yaly-sucursales.ts: es la misma sede vista
  // desde la pregunta de apertura del agente.
  id: "a" | "b" | "c";
  nombre: string;
  ubicacion: string;
  correo: string;
  checkIn: string;
  checkOut: string;
  tarifasConfirmadas: boolean;
  habitaciones: HabitacionYali[];
}

// El grupo cobra en dólares: El Salvador no tiene moneda propia desde 2001.
export const MONEDA_YALI = "USD";
export const SIMBOLO_YALI = "$";

export const SEDES_YALI: SedeYali[] = [
  {
    id: "a",
    nombre: "Yalí",
    ubicacion: "Playa El Sunzal, La Libertad",
    correo: "hola@yalihospitality.com",
    checkIn: "3:00 p.m.",
    checkOut: "12:00 m.",
    tarifasConfirmadas: false,
    habitaciones: [
      {
        id: "yali-bungalow",
        nombre: "Bungalow",
        descripcion:
          "Dos camas matrimoniales, baño privado, aire acondicionado, wifi y comedor en azotea techada privada.",
        maxHuespedes: 4,
        unidades: 4,
        tarifaDemo: 145,
      },
      {
        id: "yali-bungalow-familiar",
        nombre: "Bungalow Familiar",
        descripcion:
          "Dos camas matrimoniales y dos individuales, baño privado, aire acondicionado, wifi y comedor en azotea techada privada.",
        maxHuespedes: 6,
        unidades: 2,
        tarifaDemo: 195,
      },
      {
        id: "yali-planta-baja",
        nombre: "Planta Baja",
        descripcion:
          "Dos camas matrimoniales, baño privado, aire acondicionado y terraza privada con comedor.",
        maxHuespedes: 4,
        unidades: 5,
        tarifaDemo: 120,
      },
      {
        id: "yali-planta-alta",
        nombre: "Planta Alta estándar",
        descripcion:
          "Dos camas matrimoniales, baño privado, aire acondicionado, Smart TV, wifi y terraza privada con comedor.",
        maxHuespedes: 4,
        unidades: 4,
        tarifaDemo: 135,
      },
      {
        id: "yali-planta-alta-vista",
        nombre: "Planta Alta vista al mar",
        descripcion:
          "Planta alta con vista al mar: dos camas matrimoniales, Smart TV, wifi y terraza privada con comedor.",
        maxHuespedes: 4,
        unidades: 3,
        tarifaDemo: 165,
      },
      {
        id: "yali-planta-alta-frente",
        nombre: "Planta Alta frente al mar",
        descripcion:
          "Planta alta frente al mar: dos camas matrimoniales, Smart TV, wifi y terraza privada con comedor.",
        maxHuespedes: 4,
        unidades: 2,
        tarifaDemo: 185,
      },
    ],
  },
  {
    id: "b",
    nombre: "Costa del Surf",
    ubicacion: "Playa Las Flores, Usulután",
    correo: "costadelsurf@yalihospitality.com",
    checkIn: "3:00 p.m.",
    checkOut: "12:00 m.",
    tarifasConfirmadas: false,
    habitaciones: [
      {
        id: "cds-sencilla",
        nombre: "Sencilla",
        descripcion: "Cama matrimonial, televisión con wifi, aire acondicionado y baño privado.",
        maxHuespedes: 2,
        unidades: 4,
        tarifaDemo: 95,
      },
      {
        id: "cds-doble",
        nombre: "Doble",
        descripcion:
          "Dos camas matrimoniales, televisión con wifi, aire acondicionado y baño privado.",
        maxHuespedes: 4,
        unidades: 5,
        tarifaDemo: 125,
      },
      {
        id: "cds-garden",
        nombre: "Garden View",
        descripcion:
          "Doble con vista al jardín, televisión con wifi, aire acondicionado y baño privado.",
        maxHuespedes: 4,
        unidades: 3,
        tarifaDemo: 140,
      },
      {
        id: "cds-ocean",
        nombre: "Ocean View",
        descripcion:
          "Doble con vista al mar, televisión con wifi, aire acondicionado y baño privado.",
        maxHuespedes: 4,
        unidades: 3,
        tarifaDemo: 170,
      },
      {
        id: "cds-familiar",
        nombre: "Familiar",
        descripcion:
          "Triple con tres camas matrimoniales, televisión con wifi, aire acondicionado y baño privado.",
        maxHuespedes: 6,
        unidades: 2,
        tarifaDemo: 190,
      },
    ],
  },
  {
    id: "c",
    nombre: "Playa Linda",
    ubicacion: "Carretera Litoral, Tamanique, La Libertad",
    correo: "playalinda@yalihospitality.com",
    checkIn: "3:00 p.m.",
    checkOut: "12:00 m.",
    tarifasConfirmadas: false,
    habitaciones: [
      {
        id: "pl-sencilla",
        nombre: "Sencilla",
        descripcion: "Para dos personas, con cama matrimonial, aire acondicionado y wifi.",
        maxHuespedes: 2,
        unidades: 5,
        tarifaDemo: 85,
      },
      {
        id: "pl-doble",
        nombre: "Doble",
        descripcion: "Para cuatro personas, con dos camas matrimoniales, aire acondicionado y wifi.",
        maxHuespedes: 4,
        unidades: 5,
        tarifaDemo: 115,
      },
      {
        id: "pl-familiar",
        nombre: "Familiar",
        descripcion: "Una cama matrimonial, un camarote y dos camas individuales.",
        maxHuespedes: 6,
        unidades: 3,
        tarifaDemo: 155,
      },
      {
        id: "pl-apartamento",
        nombre: "Apartamento",
        descripcion:
          "Apartamento privado con sala, kitchenette, baño completo y tres habitaciones: principal con dos camas matrimoniales, junior con una matrimonial y junior con camarote.",
        maxHuespedes: 10,
        unidades: 1,
        tarifaDemo: 320,
      },
    ],
  },
];

export function sedePorId(id: string): SedeYali | null {
  return SEDES_YALI.find((s) => s.id === id) ?? null;
}

export function habitacionPorId(
  id: string,
): { sede: SedeYali; habitacion: HabitacionYali } | null {
  for (const sede of SEDES_YALI) {
    const habitacion = sede.habitaciones.find((h) => h.id === id);
    if (habitacion) return { sede, habitacion };
  }
  return null;
}

/** Cuántas llaves físicas hay en una sede (suma de unidades por tipo). */
export function unidadesDeSede(sede: SedeYali): number {
  return sede.habitaciones.reduce((n, h) => n + h.unidades, 0);
}

/** true mientras alguna sede siga con tarifas sin confirmar (lo pinta el panel). */
export function hayTarifasSinConfirmar(): boolean {
  return SEDES_YALI.some((s) => !s.tarifasConfirmadas);
}
