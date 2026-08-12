import { describe, expect, it } from "vitest";
import { telefonoLocal, telefonoBonito } from "../phone";

// Comportamiento real leido de lib/phone.ts:
// telefonoLocal: strips /\D/g first, then if starts with "503" AND length-3===8
//   returns slice(3), otherwise returns the raw digits string.
// telefonoBonito: calls telefonoLocal, if result is exactly 8 chars inserts a hyphen
//   at position 4, otherwise returns local unchanged.

describe("telefonoLocal", () => {
  it("quita el prefijo 503 de un numero salvadoreno de 11 digitos", () => {
    expect(telefonoLocal("50376294980")).toBe("76294980");
  });

  it("devuelve los digitos tal cual si no empieza con 503", () => {
    // "12025550123" length=11, no empieza con 503 -> retorna tal cual
    expect(telefonoLocal("12025550123")).toBe("12025550123");
  });

  it("elimina caracteres no numericos antes de evaluar (formato con espacios y guion)", () => {
    expect(telefonoLocal("+503 7629-4980")).toBe("76294980");
  });

  it("elimina caracteres unicode no numericos mezclados con el numero", () => {
    // "503-762N94980": N es \D, se elimina; digitos resultantes = "50376294980"
    expect(telefonoLocal("503-762N94980")).toBe("76294980");
  });

  it("devuelve cadena vacia para entrada vacia", () => {
    expect(telefonoLocal("")).toBe("");
  });

  it("devuelve cadena vacia para entrada con solo caracteres no numericos", () => {
    expect(telefonoLocal("abc@#!")).toBe("");
  });

  it("no quita el prefijo 503 si los digitos locales resultantes serian menos de 8", () => {
    // "5031234": length=7, length-3=4 != 8 -> retorna "5031234"
    expect(telefonoLocal("5031234")).toBe("5031234");
  });

  it("no quita el prefijo 503 si los digitos locales resultantes serian mas de 8", () => {
    // "503123456789": length=12, length-3=9 != 8 -> retorna "503123456789"
    expect(telefonoLocal("503123456789")).toBe("503123456789");
  });

  it("tambien quita el 502 del hotel, que tiene la misma numeracion de 8 digitos", () => {
    expect(telefonoLocal("50257881234")).toBe("57881234");
    expect(telefonoLocal("+502 4120-7766")).toBe("41207766");
  });

  it("no le recorta digitos a un numero de otro pais", () => {
    // Estados Unidos: 11 digitos que empiezan con 1, no se toca.
    expect(telefonoLocal("12025550123")).toBe("12025550123");
    // Mexico: 12 digitos, tampoco.
    expect(telefonoLocal("525512345678")).toBe("525512345678");
  });
});

describe("telefonoBonito", () => {
  it("formatea numero salvadoreno con prefijo 503 como XXXX-XXXX", () => {
    expect(telefonoBonito("50376294980")).toBe("7629-4980");
  });

  it("formatea un numero local de 8 digitos sin prefijo 503", () => {
    // telefonoLocal("76294980") = "76294980" (no empieza con 503, length 8)
    // telefonoBonito insertar guion en posicion 4
    expect(telefonoBonito("76294980")).toBe("7629-4980");
  });

  it("devuelve los digitos sin formato cuando no son exactamente 8 locales (numero largo sin 503)", () => {
    // "12025550123" -> local "12025550123" (11 digitos) -> sin guion
    expect(telefonoBonito("12025550123")).toBe("12025550123");
  });

  it("formatea correctamente numero con espacios y guiones en la entrada", () => {
    expect(telefonoBonito("+503 7629-4980")).toBe("7629-4980");
  });

  it("devuelve cadena vacia sin crash para entrada vacia", () => {
    expect(telefonoBonito("")).toBe("");
  });

  it("devuelve cadena vacia sin crash para entrada solo con caracteres no numericos", () => {
    expect(telefonoBonito("@@@")).toBe("");
  });

  it("devuelve digitos sin formato cuando 503 + digitos extras no dan exactamente 8 locales", () => {
    // "503123456789": telefonoLocal devuelve "503123456789" (length 12 != 8) -> sin guion
    expect(telefonoBonito("503123456789")).toBe("503123456789");
  });

  it("formatea el numero guatemalteco del hotel", () => {
    expect(telefonoBonito("50257881234")).toBe("5788-1234");
  });
});
