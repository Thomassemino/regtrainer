import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

let userId: string;

beforeEach(async () => {
  await prisma.session.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
  const user = await prisma.user.create({
    data: { email: "sesiones@example.com", passwordHash: await hashPassword("Password123"), role: "CLIENTE", emailVerified: new Date() },
  });
  userId = user.id;
  await prisma.session.createMany({
    data: [
      { sessionToken: "s1", userId, expires: new Date(Date.now() + 60_000) },
      { sessionToken: "s2", userId, expires: new Date(Date.now() + 60_000) },
    ],
  });
});

describe("cerrar todas las sesiones", () => {
  it("borra todas las Session del usuario y registra SESION_REVOCADA", async () => {
    const { cerrarTodasLasSesiones } = await import("../../lib/auth/sesiones");
    await cerrarTodasLasSesiones(userId);
    const remaining = await prisma.session.findMany({ where: { userId } });
    expect(remaining).toHaveLength(0);
    const logs = await prisma.auditLog.findMany({ where: { action: "SESION_REVOCADA" } });
    expect(logs).toHaveLength(1);
  });
});