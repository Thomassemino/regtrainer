import { describe, expect, it } from "vitest";
import { calcularPorcentajeCumplimiento } from "../../lib/rutinas/cumplimiento";

describe("calcularPorcentajeCumplimiento", () => {
  it("calcula el porcentaje redondeado", () => {
    expect(calcularPorcentajeCumplimiento(3, 4)).toBe(75);
  });

  it("devuelve 0 si no hay bloques totales (evita división por cero)", () => {
    expect(calcularPorcentajeCumplimiento(0, 0)).toBe(0);
  });

  it("redondea al entero más cercano", () => {
    expect(calcularPorcentajeCumplimiento(11, 12)).toBe(92);
  });
});