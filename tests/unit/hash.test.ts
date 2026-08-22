import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../../lib/auth/hash";

describe("hashPassword / verifyPassword", () => {
  it("verifica correctamente una contraseña correcta", async () => {
    const hash = await hashPassword("MiPassword123");
    expect(await verifyPassword(hash, "MiPassword123")).toBe(true);
  });

  it("rechaza una contraseña incorrecta", async () => {
    const hash = await hashPassword("MiPassword123");
    expect(await verifyPassword(hash, "OtraPassword456")).toBe(false);
  });

  it("dos hashes del mismo password son distintos (salt aleatorio)", async () => {
    const a = await hashPassword("MiPassword123");
    const b = await hashPassword("MiPassword123");
    expect(a).not.toBe(b);
  });
});