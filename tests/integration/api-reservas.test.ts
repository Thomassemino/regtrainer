import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";

vi.mock("../../lib/auth", () => ({
  auth: vi.fn(),
}));

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /api/reservas", () => {
  it("rechaza sin sesión", async () => {
    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue(null as never);

    const { POST } = await import("../../app/api/reservas/route");
    const res = await POST(new Request("http://localhost/api/reservas", { method: "POST", body: JSON.stringify({ claseId: "x" }) }));
    expect(res.status).toBe(401);
  });

  it("confirma una reserva de un servicio gratuito", async () => {
    const user = await prisma.user.create({
      data: { email: "reserva-http@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "HTTP Test", iniciales: "HT", objetivo: "" } });
    const servicio = await prisma.servicio.create({
      data: { slug: "evaluacion", nombre: "Evaluación inicial", tag: "Sin cargo", duracionMin: 45, precio: 0, cupoMax: 1 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 1 },
    });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const { POST } = await import("../../app/api/reservas/route");
    const res = await POST(
      new Request("http://localhost/api/reservas", { method: "POST", body: JSON.stringify({ claseId: clase.id }) })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.estado).toBe("CONFIRMADA");

    const reservaEnDb = await prisma.reserva.findUnique({ where: { id: body.reservaId } });
    expect(reservaEnDb?.clienteId).toBe(cliente.id);
  });

  it("devuelve 409 y redirigirA si el servicio es pago y no hay mensualidad", async () => {
    const user = await prisma.user.create({
      data: { email: "reserva-pago@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    await prisma.cliente.create({ data: { userId: user.id, nombre: "Pago Test", iniciales: "PT", objetivo: "" } });
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 1200000, cupoMax: 8 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 8 },
    });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    const { POST } = await import("../../app/api/reservas/route");
    const res = await POST(
      new Request("http://localhost/api/reservas", { method: "POST", body: JSON.stringify({ claseId: clase.id }) })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.redirigirA).toBe("/api/pagos/clase");
  });
});

describe("GET /api/reservas — aislamiento por cliente", () => {
  it("un cliente solo ve sus propias reservas, nunca las de otro (bug 1.4)", async () => {
    const usuarioA = await prisma.user.create({
      data: { email: "reserva-a@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const clienteA = await prisma.cliente.create({ data: { userId: usuarioA.id, nombre: "Cliente A", iniciales: "CA", objetivo: "" } });
    const usuarioB = await prisma.user.create({
      data: { email: "reserva-b@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const clienteB = await prisma.cliente.create({ data: { userId: usuarioB.id, nombre: "Cliente B", iniciales: "CB", objetivo: "" } });

    const servicio = await prisma.servicio.create({
      data: { slug: "funcional-get", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 8 },
    });
    const claseA = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 8 },
    });
    const claseB = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 48 * 60 * 60 * 1000), cupoMax: 8 },
    });
    await prisma.reserva.create({ data: { clienteId: clienteA.id, claseId: claseA.id, estado: "CONFIRMADA" } });
    await prisma.reserva.create({ data: { clienteId: clienteB.id, claseId: claseB.id, estado: "CONFIRMADA" } });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: usuarioA.id } } as never);

    const { GET } = await import("../../app/api/reservas/route");
    const res = await GET(new Request("http://localhost/api/reservas"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reservas).toHaveLength(1);
    expect(body.reservas[0].claseId).toBe(claseA.id);
    expect(body.reservas[0].servicio).toBe("Funcional");
    // Nunca la reserva del otro cliente:
    expect(body.reservas.map((r: { claseId: string }) => r.claseId)).not.toContain(claseB.id);
  });

  it("rechaza GET sin sesión", async () => {
    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue(null as never);
    const { GET } = await import("../../app/api/reservas/route");
    const res = await GET(new Request("http://localhost/api/reservas"));
    expect(res.status).toBe(401);
  });
});