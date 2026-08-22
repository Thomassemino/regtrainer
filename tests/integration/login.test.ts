import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";
import { signIn } from "../../lib/auth";
import { logAudit } from "../../lib/auth/audit";

const EMAIL = "login-test@example.com";
const PASSWORD = "Password123";

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash: await hashPassword(PASSWORD),
      role: "CLIENTE",
      emailVerified: new Date(),
    },
  });
});

describe("login", () => {
  it("falla con contraseña incorrecta y registra LOGIN_FAILED", async () => {
    await expect(
      signIn("credentials", { email: EMAIL, password: "incorrecta", redirect: false })
    ).rejects.toThrow();
    const logs = await prisma.auditLog.findMany({ where: { action: "LOGIN_FAILED" } });
    expect(logs).toHaveLength(1);
  });

  it("bloquea después de N intentos fallidos aunque la contraseña sea correcta", async () => {
    const max = Number(process.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS ?? 5);
    for (let i = 0; i < max; i++) {
      await logAudit({ email: EMAIL, action: "LOGIN_FAILED", ip: "9.9.9.9" });
    }
    await expect(
      signIn("credentials", { email: EMAIL, password: PASSWORD, redirect: false })
    ).rejects.toThrow();
  });

  it("crea una fila Session en la base al loguearse correctamente", async () => {
    await signIn("credentials", { email: EMAIL, password: PASSWORD, redirect: false });
    const sessions = await prisma.session.findMany({ where: { user: { email: EMAIL } } });
    expect(sessions).toHaveLength(1);
  });
});