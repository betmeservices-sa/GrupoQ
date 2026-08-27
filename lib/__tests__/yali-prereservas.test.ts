import { beforeEach, describe, expect, it } from "vitest";
import {
  _vaciarPreReservas,
  apartarEstadiaYali,
  confirmarPreReserva,
  listarPreReservas,
  preReservaViva,
  rechazarPreReserva,
  recibirComprobante,
  textoReservaConfirmada,
} from "../yali-prereservas";
import { hoyYali } from "../yali-pms";
import { sumarDias } from "../cloudbeds";

const CTX = { tenant: "yaly", clave: "instagram:108604138639295:1081081354381463" };

function fechas(desdeEnDias = 40, noches = 2) {
  const hoy = hoyYali();
  return { llegada: sumarDias(hoy, desdeEnDias), salida: sumarDias(hoy, desdeEnDias + noches) };
}

beforeEach(() => {
  _vaciarPreReservas();
  delete process.env.YALI_DATOS_PAGO;
});

describe("apartarEstadiaYali", () => {
  it("aparta una hora, con el total exacto y el número de apartado", async () => {
    const r = await apartarEstadiaYali(
      { nombre: "Ana Pérez", correo: "ana@x.com", habitacion: "Planta Baja", adultos: 2, ninos: 0, ...fechas() },
      "a",
      CTX,
    );
    expect(r.ok).toBe(true);
    expect(r.codigo).toMatch(/^YA-[A-Z2-9]{5}$/);
    expect(r.sede).toBe("Yalí");
    expect(r.habitacion).toBe("Planta Baja");
    expect(r.noches).toBe(2);
    expect(r.total).toBeGreaterThan(0);
    expect(r.apartada_minutos).toBe(60);
    // Sin datos de pago cargados, lo dice y manda abrir el caso.
    expect(r.datos_pago).toBeNull();
    expect(r.instrucciones).toMatch(/crear_ticket/);
    const viva = await preReservaViva("yaly", CTX.clave);
    expect(viva?.estado).toBe("pendiente_pago");
    expect(viva?.huesped).toBe("Ana Pérez");
    expect(viva?.vence).toBeTruthy();
  });

  it("con datos de pago cargados los devuelve tal cual", async () => {
    process.env.YALI_DATOS_PAGO = "Banco Agrícola, cuenta 123";
    const r = await apartarEstadiaYali({ nombre: "Ana Pérez", habitacion: "Bungalow", adultos: 2, ...fechas() }, "a", CTX);
    expect(r.datos_pago).toBe("Banco Agrícola, cuenta 123");
    expect(r.instrucciones).not.toMatch(/crear_ticket/);
  });

  it("sin nombre o con una habitación que no está libre, no aparta", async () => {
    expect((await apartarEstadiaYali({ habitacion: "Bungalow", adultos: 2, ...fechas() }, "a", CTX)).ok).toBe(false);
    const r = await apartarEstadiaYali({ nombre: "Ana", habitacion: "Suite Presidencial", adultos: 2, ...fechas() }, "a", CTX);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/no está libre/);
    expect(await preReservaViva("yaly", CTX.clave)).toBeNull();
  });

  it("un apartado nuevo reemplaza al anterior de la misma conversación", async () => {
    const uno = await apartarEstadiaYali({ nombre: "Ana", habitacion: "Planta Baja", adultos: 2, ...fechas() }, "a", CTX);
    const dos = await apartarEstadiaYali({ nombre: "Ana", habitacion: "Bungalow", adultos: 2, ...fechas(50) }, "a", CTX);
    const viva = await preReservaViva("yaly", CTX.clave);
    expect(viva?.id).toBe(dos.codigo);
    const todas = await listarPreReservas("yaly", CTX.clave);
    expect(todas.find((p) => p.id === uno.codigo)?.estado).toBe("rechazada");
  });
});

describe("comprobante y confirmación", () => {
  it("una imagen sin apartado no es un comprobante", async () => {
    expect(await recibirComprobante("yaly", CTX.clave, { url: "https://x/1.jpg" })).toBeNull();
  });

  it("la imagen marca el apartado como comprobante recibido y Verónica lo confirma", async () => {
    const a = await apartarEstadiaYali({ nombre: "Ana Pérez", habitacion: "Planta Baja", adultos: 2, ...fechas() }, "a", CTX);
    const c = await recibirComprobante("yaly", CTX.clave, { url: "https://x/1.jpg", mid: "m1" });
    expect(c?.estado).toBe("comprobante_recibido");
    expect(c?.comprobanteUrl).toBe("https://x/1.jpg");

    const r = await confirmarPreReserva("yaly", a.codigo!, { staffId: "s2", nombre: "Verónica" });
    expect(r.ok).toBe(true);
    expect(r.enCloudbeds).toBe(false); // la escritura en Cloudbeds está apagada
    expect(r.reserva?.estado).toBe("confirmada");
    expect(r.reserva?.confirmadaPor).toBe("Verónica");
    expect(await preReservaViva("yaly", CTX.clave)).toBeNull();

    const texto = textoReservaConfirmada(r.reserva!);
    expect(texto).toMatch(/confirmada/);
    expect(texto).toMatch(/Planta Baja en Yalí/);
    expect(texto).toContain(a.codigo!);
  });

  it("rechazar cierra el apartado con su motivo y no se puede confirmar después", async () => {
    const a = await apartarEstadiaYali({ nombre: "Ana", habitacion: "Planta Baja", adultos: 2, ...fechas() }, "a", CTX);
    const r = await rechazarPreReserva("yaly", a.codigo!, "pagó de menos", { nombre: "Verónica" });
    expect(r.reserva?.estado).toBe("rechazada");
    expect(r.reserva?.motivoRechazo).toBe("pagó de menos");
    expect((await confirmarPreReserva("yaly", a.codigo!, {})).ok).toBe(false);
  });
});

describe("reservarManualYali", () => {
  it("toma la reserva de una vez, a nombre de quien la tomó, y el contacto solo si hay teléfono", async () => {
    const { reservarManualYali } = await import("../yali-prereservas");
    const r = await reservarManualYali(
      "yaly",
      { nombre: "Carlos Ruiz", habitacion: "Planta Baja", adultos: 2, ninos: 0, telefono: "+503 7000 1234", notas: "llega tarde", ...fechas(60) },
      "a",
      { staffId: "s2", nombre: "Verónica" },
    );
    expect(r.ok).toBe(true);
    expect(r.reserva?.estado).toBe("confirmada");
    expect(r.reserva?.confirmadaPor).toBe("Verónica");
    expect(r.reserva?.clave).toMatch(/^manual:/);
    expect(r.reserva?.notas).toMatch(/tomada a mano por Verónica/);
    expect(r.reserva?.total).toBeGreaterThan(0);
    expect(await preReservaViva("yaly", r.reserva!.clave)).toBeNull();
  });

  it("sin nombre o con habitación que no está libre, no reserva", async () => {
    const { reservarManualYali } = await import("../yali-prereservas");
    expect((await reservarManualYali("yaly", { habitacion: "Planta Baja", adultos: 2, ...fechas(60) }, "a", {})).ok).toBe(false);
    expect((await reservarManualYali("yaly", { nombre: "Ana", habitacion: "Suite Real", adultos: 2, ...fechas(60) }, "a", {})).ok).toBe(false);
  });
});
