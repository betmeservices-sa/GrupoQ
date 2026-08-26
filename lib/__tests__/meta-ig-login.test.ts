import { describe, expect, it } from "vitest";
import {
  crearStateIg,
  esComentarioInstagram,
  hayQueRefrescar,
  urlLoginIg,
  validarStateIg,
  venceDesde,
} from "../meta-ig-login";

describe("esComentarioInstagram", () => {
  it("los de Facebook llevan el post y un guion bajo", () => {
    expect(esComentarioInstagram("113226271738310_1032971579773971")).toBe(false);
  });
  it("los de Instagram son solo dígitos", () => {
    expect(esComentarioInstagram("18214891726351572")).toBe(true);
  });
});

describe("hayQueRefrescar", () => {
  const ahora = Date.parse("2026-08-26T12:00:00Z");
  const dia = 24 * 60 * 60_000;
  it("sin fecha, sí", () => {
    expect(hayQueRefrescar(null, ahora)).toBe(true);
    expect(hayQueRefrescar("no es fecha", ahora)).toBe(true);
  });
  it("con más de una semana por delante, no", () => {
    expect(hayQueRefrescar(new Date(ahora + 30 * dia).toISOString(), ahora)).toBe(false);
  });
  it("con menos de una semana, sí", () => {
    expect(hayQueRefrescar(new Date(ahora + 3 * dia).toISOString(), ahora)).toBe(true);
  });
});

describe("venceDesde", () => {
  it("usa los segundos que manda Meta", () => {
    const ahora = Date.parse("2026-08-26T12:00:00Z");
    expect(venceDesde(3600, ahora)).toBe("2026-08-26T13:00:00.000Z");
  });
  it("sin dato asume 60 días", () => {
    const ahora = Date.parse("2026-08-26T12:00:00Z");
    expect(venceDesde(undefined, ahora)).toBe("2026-10-25T12:00:00.000Z");
  });
});

describe("state del login de Instagram", () => {
  it("lleva el tenant y se valida", () => {
    const s = crearStateIg("yaly");
    expect(validarStateIg(s)).toEqual({ ok: true, tenant: "yaly" });
  });
  it("uno alterado no pasa", () => {
    const s = crearStateIg("yaly").replace("yaly", "hotel");
    // Sin secret configurado la firma es "demo" y cualquiera pasa: eso es el
    // modo demo. Con secret, cambiar el tenant rompe la firma.
    if (process.env.META_STATE_SECRET || process.env.IG_APP_SECRET) {
      expect(validarStateIg(s)).toEqual({ ok: false });
    } else {
      expect(validarStateIg(s)).toEqual({ ok: true, tenant: "hotel" });
    }
  });
});

describe("urlLoginIg", () => {
  it("pide los tres permisos y fuerza entrar con la cuenta del negocio", () => {
    const u = new URL(urlLoginIg("yaly.abc.def", "https://demo.miagentia.com/api/meta/ig/callback"));
    expect(u.origin + u.pathname).toBe("https://www.instagram.com/oauth/authorize");
    expect(u.searchParams.get("scope")).toBe(
      "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments",
    );
    expect(u.searchParams.get("force_reauth")).toBe("true");
    expect(u.searchParams.get("state")).toBe("yaly.abc.def");
  });
});
