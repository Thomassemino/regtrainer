import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";

vi.mock("mercadopago", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  class PreApproval {
    constructor(_config?: unknown) {}
    async create() {
      return { id: "mp-preapproval-1", init_point: "https://mercadopago.com/init/abc" };
    }
    async update() {
      return { id: "mp-preapproval-1", status: "cancelled" };
    }
  }
  return { ...actual, PreApproval };
});

vi.mock("../../lib/auth", () => ({ auth: vi.fn() }));

beforeEach(async () => {
  await prisma.pago.deleteMany();
  await prisma.suscripcion.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /api/pagos/mensualidad", () => {
  it("crea SOLO el Preapproval en Mercado Pago y devuelve initPoint, sin crear Suscripcion todavia", async () => {
    const user = await prisma.user.create({
      data: { email: "mensual-http@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    await prisma.cliente.create({ data: { userId: user.id, nombre: "Mensual HTTP", iniciales: "MH", objetivo: "" } });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const { POST } = await import("../../app/api/pagos/mensualidad/route");
    const res = await POST(new Request("http://localhost/api/pagos/mensualidad", { method: "POST" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.initPoint).toContain("mercadopago.com");

    // Bug de la auditoría (1.1): nada debe persistir hasta que el webhook confirme la autorización.
    const suscripciones = await prisma.suscripcion.findMany();
    expect(suscripciones).toHaveLength(0);
  });
});

describe("POST /api/mensualidad/cancelar", () => {
  it("marca la Suscripcion como CANCELADA sin borrar el acceso ya pago", async () => {
    const user = await prisma.user.create({
      data: { email: "cancelar-mensual@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Cancelar Mensual", iniciales: "CM", objetivo: "" } });
    await prisma.suscripcion.create({
      data: {
        clienteId: cliente.id,
        estado: "ACTIVA",
        precio: 15000000,
        fechaProximoCobro: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        mpPreapprovalId: "mp-preapproval-1",
      },
    });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const { POST } = await import("../../app/api/mensualidad/cancelar/route");
    const res = await POST(new Request("http://localhost/api/mensualidad/cancelar", { method: "POST" }));
    expect(res.status).toBe(200);

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    expect(suscripcion.estado).toBe("CANCELADA");
    expect(suscripcion.canceladaEn).not.toBeNull();
  });
});