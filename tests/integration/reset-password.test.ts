import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword, verifyPassword } from "../../lib/auth/hash";
import { generateToken } from "../../lib/auth/tokens";

vi.mock("../../lib/email/templates", () => ({ sendPasswordResetEmail: vi.fn() }));

let userId: string;

beforeEach(async () => {
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
  const user = await prisma.user.create({
    data: { email: "reset@example.com", passwordHash: await hashPassword("ViejaPassword1"), role: "CLIENTE", emailVerified: new Date() },
  });
  userId = user.id;
});

describe("reset de password", () => {
  it("actualiza el password y revoca sesiones existentes", async () => {
    await prisma.session.create({ data: { sessionToken: "vieja", userId, expires: new Date(Date.now() + 60_000) } });

    const { raw, hash } = generateToken();
    await prisma.passwordResetToken.create({
      data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    const { resetearPassword } = await import("../../lib/auth/reset-password");
    const ok = await resetearPassword(raw, "NuevaPassword2");
    expect(ok).toBe(true);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await verifyPassword(updated.passwordHash, "NuevaPassword2")).toBe(true);

    const sessions = await prisma.session.findMany({ where: { userId } });
    expect(sessions).toHaveLength(0);
  });

  it("un token ya usado no puede reutilizarse", async () => {
    const { raw, hash } = generateToken();
    await prisma.passwordResetToken.create({
      data: { userId, tokenHash: hash, expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });
    const { resetearPassword } = await import("../../lib/auth/reset-password");
    expect(await resetearPassword(raw, "Primera1")).toBe(true);
    expect(await resetearPassword(raw, "Segunda2")).toBe(false);
  });
});