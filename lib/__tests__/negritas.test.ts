import { describe, expect, it } from "vitest";
import { paraWhatsApp, sinMarkdown } from "../negritas";

describe("sinMarkdown (Messenger e Instagram)", () => {
  it("quita las negritas de markdown y las de WhatsApp", () => {
    expect(sinMarkdown("Su habitación **Planta Baja** está apartada. **Total: $180**")).toBe(
      "Su habitación Planta Baja está apartada. Total: $180",
    );
    expect(sinMarkdown("La *Planta Baja* es la más accesible.")).toBe("La Planta Baja es la más accesible.");
  });

  it("no toca un asterisco suelto ni una multiplicación", () => {
    expect(sinMarkdown("2 * 3 = 6")).toBe("2 * 3 = 6");
    expect(sinMarkdown("Precio: $40*")).toBe("Precio: $40*");
  });

  it("los títulos y las listas quedan como texto plano", () => {
    expect(sinMarkdown("## Opciones\n- Bungalow\n- Planta Baja")).toBe("Opciones\n• Bungalow\n• Planta Baja");
  });
});

describe("paraWhatsApp", () => {
  it("convierte ** a * y deja lo demás", () => {
    expect(paraWhatsApp("**Total: $180** por 2 noches")).toBe("*Total: $180* por 2 noches");
    expect(paraWhatsApp("ya *está* en negrita")).toBe("ya *está* en negrita");
  });
});
