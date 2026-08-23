import { describe, expect, it, beforeAll } from "vitest";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-secret-at-least-32-characters";
});

describe("verificarTokenComprobante", () => {
  it("acepta el token generado para el mismo pagoId", async () => {
    const { generarTokenComprobante, verificarTokenComprobante } = await import("../../lib/comprobantes/generar");
    const token = generarTokenComprobante("pago-123");
    expect(verificarTokenComprobante("pago-123", token)).toBe(true);
  });

  it("rechaza el token de otro pagoId", async () => {
    const { generarTokenComprobante, verificarTokenComprobante } = await import("../../lib/comprobantes/generar");
    const token = generarTokenComprobante("pago-123");
    expect(verificarTokenComprobante("pago-999", token)).toBe(false);
  });
});