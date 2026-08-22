import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";

vi.mock("../../lib/email/templates", () => ({
  sendVerificationEmail: vi.fn(),
}));

beforeEach(async () => {
  await prisma.auditLog.deleteMany();
  await prisma.emailVerificationToken.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /api/auth/registro", () => {
  it("crea el usuario, el cliente, y no verifica el email todavía", async () => {
    const { POST } = await import("../../app/api/auth/registro/route");
    const req = new Request("http://localhost/api/auth/registro", {
      method: "POST",
      body: JSON.stringify({ email: "nueva@example.com", password: "Password123", nombre: "Nueva Cliente" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email: "nueva@example.com" }, include: { cliente: true } });
    expect(user).not.toBeNull();
    expect(user!.emailVerified).toBeNull();
    expect(user!.cliente?.nombre).toBe("Nueva Cliente");
  });

  it("rechaza un password de menos de 10 caracteres", async () => {
    const { POST } = await import("../../app/api/auth/registro/route");
    const req = new Request("http://localhost/api/auth/registro", {
      method: "POST",
      body: JSON.stringify({ email: "corta@example.com", password: "abc123", nombre: "X" }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/verificar-email", () => {
  it("marca emailVerified cuando el token es válido", async () => {
    const { POST } = await import("../../app/api/auth/registro/route");
    await POST(
      new Request("http://localhost/api/auth/registro", {
        method: "POST",
        body: JSON.stringify({ email: "verificar@example.com", password: "Password123", nombre: "Y" }),
      }) as any
    );
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "verificar@example.com" } });
    const tokenRow = await prisma.emailVerificationToken.findFirstOrThrow({ where: { userId: user.id } });

    const { verifyEmailToken } = await import("../../lib/auth/verify-email-token");
    const ok = await verifyEmailToken(tokenRow.tokenHash);
    expect(ok).toBe(true);

    const updated = await prisma.user.findUniqueOrThrow({ where: { email: "verificar@example.com" } });
    expect(updated.emailVerified).not.toBeNull();
  });
});