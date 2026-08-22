import { describe, expect, it } from "vitest";
import { pctParaSemana, repsParaSemana } from "../../lib/rutinas/progresion";

describe("pctParaSemana", () => {
  it("sigue la serie de intensidades del handoff para las 8 semanas posibles", () => {
    const esperado = [70, 75, 80, 65, 72, 78, 82, 68];
    esperado.forEach((pct, i) => expect(pctParaSemana(i + 1)).toBe(pct));
  });
});

describe("repsParaSemana", () => {
  it("cicla 6, 5, 4, 5 cada 4 semanas", () => {
    const esperado = [6, 5, 4, 5, 6, 5, 4, 5];
    esperado.forEach((reps, i) => expect(repsParaSemana(i + 1)).toBe(reps));
  });
});