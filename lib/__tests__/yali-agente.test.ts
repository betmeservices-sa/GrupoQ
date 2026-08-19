// Las herramientas con las que Sofía cotiza y reserva, y el perfil resumido que
// ve el dueño. Lo que cuidan estas pruebas:
//   - que sin sede NO conteste (mandaría al huésped al hotel equivocado);
//   - que no cotice fechas imposibles ni que ya pasaron;
//   - que no confirme una habitación que no existe o que no aguanta al grupo;
//   - que la reserva quede guardada en el demo y NO en el sistema del hotel;
//   - que el perfil siga mostrando cuatro tarjetas y nada del guion completo.
import { describe, it, expect, beforeEach } from "vitest";
import {
  consultarDisponibilidadYali,
  emparejarHabitacion,
  reservarHabitacionYali,
} from "@/lib/yali-agente";
import { borrarReservasYali, listarReservasYali } from "@/lib/yali-reservas";
import { hoyYali } from "@/lib/yali-pms";
import { SEDES_YALI } from "@/lib/tenants/yali-inventario";
import { perfilDeTenant, campoPerfil, numeroDeGestion } from "@/lib/perfil-agente";
import { sumarDias } from "@/lib/cloudbeds";

const SEDE = SEDES_YALI[0];
const LLEGADA = sumarDias(hoyYali(), 10);
const SALIDA = sumarDias(hoyYali(), 12);

beforeEach(() => {
  borrarReservasYali();
});

describe("consultar habitaciones", () => {
  it("sin sede no contesta: preguntar es mejor que mandarlo al hotel equivocado", async () => {
    const r = await consultarDisponibilidadYali({ llegada: LLEGADA, salida: SALIDA, adultos: 2 });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/cuál de los tres hoteles/);
  });

  it("rechaza fechas que faltan, invertidas o pasadas", async () => {
    const sinFechas = await consultarDisponibilidadYali({ adultos: 2 }, SEDE.id);
    expect(sinFechas.ok).toBe(false);

    const invertidas = await consultarDisponibilidadYali(
      { llegada: SALIDA, salida: LLEGADA, adultos: 2 },
      SEDE.id,
    );
    expect(invertidas.ok).toBe(false);

    const pasada = await consultarDisponibilidadYali(
      { llegada: sumarDias(hoyYali(), -5), salida: sumarDias(hoyYali(), -3), adultos: 2 },
      SEDE.id,
    );
    expect(pasada.ok).toBe(false);
    expect(pasada.error).toMatch(/ya pasó/);
  });

  it("devuelve opciones de esa sede, con tarifa y total de la estadía", async () => {
    const r = await consultarDisponibilidadYali(
      { llegada: LLEGADA, salida: SALIDA, adultos: 2 },
      SEDE.id,
    );
    expect(r.ok).toBe(true);
    expect(r.sede).toBe(SEDE.nombre);
    expect(r.noches).toBe(2);
    for (const o of r.opciones ?? []) {
      expect(SEDE.habitaciones.map((h) => h.nombre)).toContain(o.habitacion);
      expect(o.total_estadia).toBe(o.tarifa_por_noche * 2);
      expect(o.hasta_huespedes).toBeGreaterThanOrEqual(2);
    }
  });

  it("avisa que las tarifas están sin confirmar mientras el hotel no las dé", async () => {
    const r = await consultarDisponibilidadYali(
      { llegada: LLEGADA, salida: SALIDA, adultos: 2 },
      SEDE.id,
    );
    expect(r.aviso_tarifas).toMatch(/el equipo confirma el precio final/);
  });

  it("un grupo enorme no recibe habitaciones que no lo aguantan", async () => {
    const r = await consultarDisponibilidadYali(
      { llegada: LLEGADA, salida: SALIDA, adultos: 20 },
      SEDE.id,
    );
    expect(r.ok).toBe(true);
    expect(r.opciones).toEqual([]);
    expect(r.nota).toMatch(/No hay habitaciones libres/);
  });
});

describe("emparejar la habitación que dijo el modelo", () => {
  it("calza exacto, sin acentos y por contenido", () => {
    const hs = SEDE.habitaciones;
    expect(emparejarHabitacion(hs, "Bungalow")?.nombre).toBe("Bungalow");
    expect(emparejarHabitacion(hs, "planta alta estandar")?.nombre).toBe("Planta Alta estándar");
    expect(emparejarHabitacion(hs, "bungalow familiar")?.nombre).toBe("Bungalow Familiar");
  });

  it("nunca adivina: lo que no calza devuelve null", () => {
    expect(emparejarHabitacion(SEDE.habitaciones, "suite presidencial")).toBeNull();
    expect(emparejarHabitacion(SEDE.habitaciones, "")).toBeNull();
  });
});

describe("reservar", () => {
  it("sin nombre completo no reserva", async () => {
    const r = await reservarHabitacionYali(
      { habitacion: "Bungalow", llegada: LLEGADA, salida: SALIDA, adultos: 2 },
      SEDE.id,
    );
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("datos");
  });

  it("una habitación que no existe se rechaza en vez de inventarse", async () => {
    const r = await reservarHabitacionYali(
      {
        nombre: "Prueba Prueba",
        habitacion: "Suite Presidencial",
        llegada: LLEGADA,
        salida: SALIDA,
        adultos: 2,
      },
      SEDE.id,
    );
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("desconocida");
  });

  it("no mete a más gente de la que cabe", async () => {
    const r = await reservarHabitacionYali(
      {
        nombre: "Prueba Prueba",
        habitacion: "Bungalow",
        llegada: LLEGADA,
        salida: SALIDA,
        adultos: 9,
      },
      SEDE.id,
    );
    expect(r.ok).toBe(false);
    expect(r.motivo).toBe("capacidad");
  });

  it("una reserva buena queda guardada en el demo con su número", async () => {
    const disponibles = await consultarDisponibilidadYali(
      { llegada: LLEGADA, salida: SALIDA, adultos: 2 },
      SEDE.id,
    );
    const opcion = disponibles.opciones?.[0];
    expect(opcion).toBeDefined();

    const r = await reservarHabitacionYali(
      {
        nombre: "Marta Elena Rivas",
        habitacion: opcion!.habitacion,
        llegada: LLEGADA,
        salida: SALIDA,
        adultos: 2,
        telefono: "50370000000",
      },
      SEDE.id,
    );
    expect(r.ok).toBe(true);
    expect(r.reserva).toMatch(/^YH-/);
    expect(r.total).toBe(opcion!.total_estadia);

    const guardadas = listarReservasYali();
    expect(guardadas).toHaveLength(1);
    expect(guardadas[0].huesped).toBe("Marta Elena Rivas");
    expect(guardadas[0].sedeId).toBe(SEDE.id);
    expect(guardadas[0].origen).toBe("agente");
  });
});

describe("perfil que ve el dueño", () => {
  it("son cuatro tarjetas y solo las tiene Yali", () => {
    const campos = perfilDeTenant("yaly");
    expect(campos.map((c) => c.id)).toEqual(["personalidad", "objetivo", "saludo", "limites"]);
    expect(perfilDeTenant("hotel")).toEqual([]);
    expect(perfilDeTenant("hospital")).toEqual([]);
  });

  it("no filtra el guion completo: son resúmenes cortos y sin tecnicismos", () => {
    for (const c of perfilDeTenant("yaly")) {
      expect(c.texto.length).toBeLessThan(320);
      expect(c.texto).not.toContain("—");
      // Nada de nombres de herramientas ni de encabezados del guion.
      expect(c.texto).not.toMatch(/consultar_habitaciones|reservar_estadia|SEGURIDAD|system/i);
    }
  });

  it("un campo que no existe no se puede editar", () => {
    expect(campoPerfil("yaly", "personalidad")?.titulo).toBe("Personalidad");
    expect(campoPerfil("yaly", "precio")).toBeNull();
    expect(campoPerfil("hotel", "personalidad")).toBeNull();
  });

  it("el número de gestión lo emite el servidor y no se repite", () => {
    const n = numeroDeGestion();
    expect(n).toMatch(/^SOL-\d{6}$/);
    const muchos = new Set(Array.from({ length: 50 }, () => numeroDeGestion()));
    expect(muchos.size).toBeGreaterThan(40);
  });
});
