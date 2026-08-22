import { describe, expect, it } from "vitest";
import { centavosAPesos, pesosACentavos } from "../../lib/dinero";

describe("pesosACentavos / centavosAPesos", () => {
  it("convierte pesos a centavos", () => {
    expect(pesosACentavos(22000)).toBe(2200000);
  });

  it("convierte centavos a pesos", () => {
    expect(centavosAPesos(2200000)).toBe(22000);
  });

  it("es inverso en ambos sentidos", () => {
    expect(centavosAPesos(pesosACentavos(15000))).toBe(15000);
  });

  it("0 pesos es 0 centavos (servicio sin cargo)", () => {
    expect(pesosACentavos(0)).toBe(0);
  });
});