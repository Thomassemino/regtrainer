import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";

vi.mock("../../lib/auth", () => ({ auth: vi.fn() }));

beforeEach(async () => {
  await prisma.pago.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("PATCH /api/coach/pagos/:id", () => {
  it("rechaza si la sesión no es ADMIN", async () => {
    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "x", role: "CLIENTE" } } as never);

    const { PATCH } = await import("../../app/api/coach/pagos/[id]/route");
    const res = await PATCH(
      new Request("http://localhost/api/coach/pagos/abc", { method: "PATCH" }),
      { params: Promise.resolve({ id: "abc" }) }
    );
    expect(res.status).toBe(403);
  });

  it("marca un pago en efectivo como APROBADO cuando la sesión es ADMIN", async () => {
    const user = await prisma.user.create({
      data: { email: "efectivo@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Efectivo Test", iniciales: "ET", objetivo: "" } });
    const pago = await prisma.pago.create({
      data: { clienteId: cliente.id, tipo: "CLASE_SUELTA", medio: "EFECTIVO", monto: 1200000, estado: "PENDIENTE" },
    });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-id", role: "ADMIN" } } as never);

    const { PATCH } = await import("../../app/api/coach/pagos/[id]/route");
    const res = await PATCH(
      new Request(`http://localhost/api/coach/pagos/${pago.id}`, { method: "PATCH" }),
      { params: Promise.resolve({ id: pago.id }) }
    );
    expect(res.status).toBe(200);

    const pagoActualizado = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
    expect(pagoActualizado.estado).toBe("APROBADO");
  });

  it("rechaza con 409 aprobar un pago que ya no esta PENDIENTE y no lo revive (bug 1.3)", async () => {
    const user = await prisma.user.create({
      data: { email: "reembolsado@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Reembolsado Test", iniciales: "RT", objetivo: "" } });
    const pago = await prisma.pago.create({
      data: { clienteId: cliente.id, tipo: "CLASE_SUELTA", medio: "EFECTIVO", monto: 1200000, estado: "REEMBOLSADO" },
    });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: "admin-id", role: "ADMIN" } } as never);

    const { PATCH } = await import("../../app/api/coach/pagos/[id]/route");
    const res = await PATCH(
      new Request(`http://localhost/api/coach/pagos/${pago.id}`, { method: "PATCH" }),
      { params: Promise.resolve({ id: pago.id }) }
    );
    expect(res.status).toBe(409);

    const pagoTrasIntento = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
    expect(pagoTrasIntento.estado).toBe("REEMBOLSADO");
  });
});