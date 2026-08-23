import { describe, expect, it } from "vitest";
import { calcularSemanaActual } from "../../lib/rutinas/semana-actual";

describe("calcularSemanaActual", () => {
  it("da semana 1 para una asignación de hoy", () => {
    expect(calcularSemanaActual(new Date(), 8)).toBe(1);
  });

  it("no supera el total de semanas del programa aunque haya pasado mucho más tiempo", () => {
    const haceUnAnio = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    expect(calcularSemanaActual(haceUnAnio, 4)).toBe(4);
  });

  it("avanza una semana por cada 7 días completos transcurridos", () => {
    const hace15Dias = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
    expect(calcularSemanaActual(hace15Dias, 8)).toBe(3);
  });
});
