import { describe, expect, it } from "vitest";
import { semanaCalendarioActual } from "../../lib/reservas/mensualidad";

describe("semanaCalendarioActual", () => {
  it("un miércoles devuelve el lunes de esa semana como inicio", () => {
    const miercoles = new Date("2026-08-19T15:00:00.000Z"); // miércoles
    const { inicio, fin } = semanaCalendarioActual(miercoles);
    expect(inicio.toISOString()).toBe("2026-08-17T00:00:00.000Z"); // lunes
    expect(fin.toISOString()).toBe("2026-08-24T00:00:00.000Z"); // lunes siguiente (exclusivo)
  });

  it("un domingo pertenece a la semana que empezó el lunes anterior", () => {
    const domingo = new Date("2026-08-23T10:00:00.000Z");
    const { inicio, fin } = semanaCalendarioActual(domingo);
    expect(inicio.toISOString()).toBe("2026-08-17T00:00:00.000Z");
    expect(fin.toISOString()).toBe("2026-08-24T00:00:00.000Z");
  });

  it("un lunes es el propio inicio de semana", () => {
    const lunes = new Date("2026-08-17T05:00:00.000Z");
    const { inicio } = semanaCalendarioActual(lunes);
    expect(inicio.toISOString()).toBe("2026-08-17T00:00:00.000Z");
  });
});