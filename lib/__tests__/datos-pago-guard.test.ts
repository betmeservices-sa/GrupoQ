import { describe, expect, it } from "vitest";
import { datosDePagoInventados, numerosDeCuenta, quitarDatosDePago } from "../datos-pago-guard";

// Lo que Sofía escribió de verdad en la prueba del 27 de agosto, sin haber
// llamado a la herramienta.
const INVENTADO = `Listo, Ana. El total es $180. La habitación queda apartada una hora a partir de ahora.

Los datos de pago son:

**Transferencia bancaria:**
Banco Agrícola
Cuenta: 2100 0123 456789
A nombre de: Yali Hospitality Group

**Enlace de pago:** paymentlink.yali.sv/2024oct-bp

Recuerde que esta tarifa es preferencial y no es reembolsable. Apenas haga el pago, envíe la captura por este chat.`;

describe("datosDePagoInventados", () => {
  it("cacha la cuenta y el enlace inventados cuando el hotel no cargó datos", () => {
    expect(datosDePagoInventados(INVENTADO, null)).toBe(true);
  });

  it("deja pasar los datos que sí cargó el hotel", () => {
    const legitimos = "Banco Agrícola, cuenta 2100 0123 456789 a nombre de Yali Hospitality";
    expect(datosDePagoInventados("Transfiera a Banco Agrícola, cuenta 2100 0123 456789.", legitimos)).toBe(false);
    // Otra cuenta distinta a la cargada sigue siendo inventada.
    expect(datosDePagoInventados("Transfiera a la cuenta 9999 8888 7777 11.", legitimos)).toBe(true);
  });

  it("un teléfono de El Salvador o un total no son una cuenta", () => {
    expect(datosDePagoInventados("Puede llamarnos al +503 7020 0301. El total es $180 por 2 noches.", null)).toBe(false);
    expect(numerosDeCuenta("Reserva 5PMKT95BU4, total $1,227.50")).toEqual([]);
  });

  it("un enlace cualquiera cuenta como enlace de pago si no está cargado", () => {
    expect(datosDePagoInventados("Pague aquí: https://pagos.yali.sv/abc", null)).toBe(true);
    expect(datosDePagoInventados("Pague aquí: https://pagos.yali.sv/abc", "Enlace: https://pagos.yali.sv/abc")).toBe(false);
  });
});

describe("quitarDatosDePago", () => {
  it("deja el mensaje sin la cuenta ni el enlace y avisa que Verónica manda los datos", () => {
    const limpio = quitarDatosDePago(INVENTADO);
    expect(limpio).not.toMatch(/2100|Agrícola|paymentlink|A nombre de/);
    expect(limpio).toMatch(/El total es \$180/);
    expect(limpio).toMatch(/Verónica/);
  });
});
