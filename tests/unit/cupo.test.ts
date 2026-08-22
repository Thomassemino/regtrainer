import { describe, expect, it } from "vitest";
import { calcularEstadoReserva } from "../../lib/reservas/cupo";

describe("calcularEstadoReserva", () => {
  it("confirma si hay lugar", () => {
    expect(calcularEstadoReserva(3, 8)).toBe("CONFIRMADA");
  });

  it("confirma en el último lugar disponible", () => {
    expect(calcularEstadoReserva(7, 8)).toBe("CONFIRMADA");
  });

  it("manda a lista de espera al llegar al cupo máximo", () => {
    expect(calcularEstadoReserva(8, 8)).toBe("LISTA_ESPERA");
  });

  it("manda a lista de espera por encima del cupo máximo", () => {
    expect(calcularEstadoReserva(9, 8)).toBe("LISTA_ESPERA");
  });

  it("con cupoMax 1, la primera confirma y cualquier otra va a lista de espera", () => {
    expect(calcularEstadoReserva(0, 1)).toBe("CONFIRMADA");
    expect(calcularEstadoReserva(1, 1)).toBe("LISTA_ESPERA");
  });
});