import { describe, expect, it } from "vitest";
import { puedeCancelarSinCargo } from "../../lib/reservas/cancelar";

describe("puedeCancelarSinCargo", () => {
  it("permite cancelar sin cargo con más de 12hs de anticipación", () => {
    const ahora = new Date("2026-08-20T10:00:00.000Z");
    const claseEn13hs = new Date("2026-08-20T23:00:00.000Z");
    expect(puedeCancelarSinCargo(claseEn13hs, ahora)).toBe(true);
  });

  it("exactamente 12hs cuenta como sin cargo (borde inclusivo)", () => {
    const ahora = new Date("2026-08-20T10:00:00.000Z");
    const claseEn12hs = new Date("2026-08-20T22:00:00.000Z");
    expect(puedeCancelarSinCargo(claseEn12hs, ahora)).toBe(true);
  });

  it("no reembolsa con menos de 12hs de anticipación", () => {
    const ahora = new Date("2026-08-20T10:00:00.000Z");
    const claseEn6hs = new Date("2026-08-20T16:00:00.000Z");
    expect(puedeCancelarSinCargo(claseEn6hs, ahora)).toBe(false);
  });
});