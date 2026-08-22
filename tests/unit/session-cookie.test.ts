import { describe, expect, it } from "vitest";
import { extraerCookieSesion } from "../../lib/pdf/session-cookie";

describe("extraerCookieSesion", () => {
  it("extrae la cookie de sesión de Auth.js entre otras cookies", () => {
    const header = "otra=valor; authjs.session-token=abc123; theme=dark";
    expect(extraerCookieSesion(header)).toEqual({ name: "authjs.session-token", value: "abc123" });
  });

  it("reconoce la variante __Secure- usada en producción sobre HTTPS", () => {
    const header = "__Secure-authjs.session-token=xyz789";
    expect(extraerCookieSesion(header)).toEqual({ name: "__Secure-authjs.session-token", value: "xyz789" });
  });

  it("devuelve null si no hay ninguna cookie de sesión reconocida", () => {
    expect(extraerCookieSesion("theme=dark; lang=es")).toBeNull();
  });

  it("devuelve null si el header es null", () => {
    expect(extraerCookieSesion(null)).toBeNull();
  });
});