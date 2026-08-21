// El reloj hábil de los tickets.
//
// El caso que originó todo esto lo puso Helen en la reunión del 20 de agosto:
// un ticket que entra a las 2 de la mañana y se resuelve a las 8:15 no tardó
// 6 horas, tardó 15 minutos. Si el número no distingue eso, mide al hospital
// cerrado y no a la persona, y encima castiga a quien agarra el turno de la
// mañana.
import { describe, it, expect } from "vitest";
import {
  HORARIO_HOSPITAL,
  HORARIO_CONTINUO,
  estaAbiertoAhora,
  formatearMinutos,
  minutosHabiles,
  proximaApertura,
} from "@/lib/tickets-sla";

/**
 * Hora LOCAL de El Salvador, devuelta como el ISO en UTC que guarda la app.
 *
 * La primera versión de estas pruebas escribía las horas directo en UTC y
 * quedaron todas corridas seis horas: "lunes 00:00Z" es domingo por la tarde,
 * no lunes. Con el helper al revés, la prueba dice la hora que uno piensa.
 */
const sv = (dia: string, hora: string) => {
  const [h, m = 0] = hora.split(":").map(Number);
  return new Date(Date.parse(`${dia}T00:00:00.000Z`) + (h + 6) * 3_600_000 + m * 60_000).toISOString();
};

const LUN = "2026-08-24";
const MAR = "2026-08-25";
const SAB = "2026-08-29";
const DOM = "2026-08-30";
const LUN2 = "2026-08-31";

describe("minutos hábiles dentro de un mismo día", () => {
  it("cuenta el tramo tal cual si el hospital está abierto", () => {
    expect(minutosHabiles(sv(LUN, "09:00"), sv(LUN, "11:30"), HORARIO_HOSPITAL)).toBe(150);
  });

  it("no cuenta lo que pasa antes de abrir", () => {
    // El caso de Helen: entra a las 2, se toma a las 8:15. Son 15 minutos.
    expect(minutosHabiles(sv(LUN, "02:00"), sv(LUN, "07:15"), HORARIO_HOSPITAL)).toBe(15);
  });

  it("no cuenta lo que pasa después de cerrar", () => {
    // 18:30 a 22:00: solo los 30 minutos que quedan hasta las 19:00.
    expect(minutosHabiles(sv(LUN, "18:30"), sv(LUN, "22:00"), HORARIO_HOSPITAL)).toBe(30);
  });

  it("un tramo entero fuera de horario da cero, no un número raro", () => {
    expect(minutosHabiles(sv(LUN, "20:00"), sv(LUN, "23:00"), HORARIO_HOSPITAL)).toBe(0);
    expect(minutosHabiles(sv(LUN, "01:00"), sv(LUN, "05:00"), HORARIO_HOSPITAL)).toBe(0);
  });

  it("un domingo entero no suma nada", () => {
    expect(minutosHabiles(sv(DOM, "08:00"), sv(DOM, "20:00"), HORARIO_HOSPITAL)).toBe(0);
  });
});

describe("minutos hábiles cruzando días", () => {
  it("suma solo las jornadas, no las noches", () => {
    // Lunes 18:00 a martes 08:00: una hora de cada día.
    expect(minutosHabiles(sv(LUN, "18:00"), sv(MAR, "08:00"), HORARIO_HOSPITAL)).toBe(120);
  });

  it("salta el domingo entero", () => {
    // Sábado 12:00 a lunes 08:00: 60 del sábado, 0 del domingo, 60 del lunes.
    expect(minutosHabiles(sv(SAB, "12:00"), sv(LUN2, "08:00"), HORARIO_HOSPITAL)).toBe(120);
  });

  it("el sábado corto cuenta sus 5 horas y no 12", () => {
    expect(minutosHabiles(sv(SAB, "00:00"), sv(SAB, "23:59"), HORARIO_HOSPITAL)).toBe(300);
  });

  it("una semana entera son cinco jornadas largas y una corta", () => {
    // 5 x 12 h + 5 h = 3.900 minutos.
    expect(minutosHabiles(sv(LUN, "00:00"), sv(DOM, "23:59"), HORARIO_HOSPITAL)).toBe(3900);
  });
});

describe("casos borde que no pueden dar un número inventado", () => {
  it("si el cierre es anterior a la apertura, da cero y no negativo", () => {
    expect(minutosHabiles(sv(LUN, "17:00"), sv(LUN, "15:00"), HORARIO_HOSPITAL)).toBe(0);
  });

  it("mismo instante, cero", () => {
    expect(minutosHabiles(sv(LUN, "15:00"), sv(LUN, "15:00"), HORARIO_HOSPITAL)).toBe(0);
  });

  it("una fecha corrupta da cero en vez de NaN", () => {
    // NaN se propagaría al promedio y dejaría el panel entero en blanco.
    expect(minutosHabiles("no es fecha", sv(LUN, "15:00"), HORARIO_HOSPITAL)).toBe(0);
    expect(minutosHabiles(sv(LUN, "15:00"), "", HORARIO_HOSPITAL)).toBe(0);
  });

  it("el horario corrido cuenta el reloj de pared", () => {
    expect(minutosHabiles(sv(LUN, "00:00"), sv(LUN, "06:00"), HORARIO_CONTINUO)).toBe(360);
    expect(minutosHabiles(sv(DOM, "00:00"), sv(DOM, "12:00"), HORARIO_CONTINUO)).toBe(720);
  });
});

describe("cuándo vuelve a abrir", () => {
  it("dentro del horario, es ahora mismo", () => {
    expect(proximaApertura(sv(LUN, "09:00"), HORARIO_HOSPITAL)).toBe(sv(LUN, "09:00"));
  });

  it("de madrugada, es la apertura del mismo día", () => {
    expect(proximaApertura(sv(LUN, "02:00"), HORARIO_HOSPITAL)).toBe(sv(LUN, "07:00"));
  });

  it("un domingo, es el lunes a las 7", () => {
    expect(proximaApertura(sv(DOM, "10:00"), HORARIO_HOSPITAL)).toBe(sv(LUN2, "07:00"));
  });

  it("después de cerrar, es el día siguiente", () => {
    expect(proximaApertura(sv(LUN, "20:00"), HORARIO_HOSPITAL)).toBe(sv(MAR, "07:00"));
  });

  it("el sábado por la tarde, es el lunes", () => {
    expect(proximaApertura(sv(SAB, "15:00"), HORARIO_HOSPITAL)).toBe(sv(LUN2, "07:00"));
  });
});

describe("si está abierto ahora", () => {
  it("distingue dentro y fuera de la jornada", () => {
    expect(estaAbiertoAhora(sv(LUN, "09:00"), HORARIO_HOSPITAL)).toBe(true);
    expect(estaAbiertoAhora(sv(LUN, "02:00"), HORARIO_HOSPITAL)).toBe(false);
    expect(estaAbiertoAhora(sv(DOM, "10:00"), HORARIO_HOSPITAL)).toBe(false);
  });

  it("el sábado cierra a la 1 de la tarde", () => {
    expect(estaAbiertoAhora(sv(SAB, "12:00"), HORARIO_HOSPITAL)).toBe(true);
    expect(estaAbiertoAhora(sv(SAB, "14:00"), HORARIO_HOSPITAL)).toBe(false);
  });

  it("el minuto del cierre ya está cerrado", () => {
    expect(estaAbiertoAhora(sv(LUN, "18:59"), HORARIO_HOSPITAL)).toBe(true);
    expect(estaAbiertoAhora(sv(LUN, "19:00"), HORARIO_HOSPITAL)).toBe(false);
  });
});

describe("cómo se lee el tiempo", () => {
  it("usa jornadas de 12 horas y no días de 24", () => {
    // 13 horas hábiles es más de una jornada de trabajo, no "medio día".
    expect(formatearMinutos(0)).toBe("0 min");
    expect(formatearMinutos(45)).toBe("45 min");
    expect(formatearMinutos(135)).toBe("2 h 15 min");
    expect(formatearMinutos(120)).toBe("2 h");
    expect(formatearMinutos(13 * 60)).toBe("1 d 1 h");
    expect(formatearMinutos(24 * 60)).toBe("2 d");
  });
});
