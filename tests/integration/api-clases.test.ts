import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.horarioRecurrente.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("GET /api/clases", () => {
  it("devuelve las clases futuras del servicio pedido con el cupo calculado", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 2 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), cupoMax: 2 },
    });
    const user = await prisma.user.create({
      data: { email: "cupo@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({
      data: { userId: user.id, nombre: "Cupo Test", iniciales: "CT", objetivo: "" },
    });
    await prisma.reserva.create({ data: { clienteId: cliente.id, claseId: clase.id, estado: "CONFIRMADA" } });

    const { GET } = await import("../../app/api/clases/route");
    const res = await GET(new Request(`http://localhost/api/clases?servicioId=${servicio.id}`));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.clases).toHaveLength(1);
    expect(body.clases[0].cuposOcupados).toBe(1);
    expect(body.clases[0].cuposDisponibles).toBe(1);
    expect(body.clases[0].lleno).toBe(false);
  });

  it("no devuelve clases canceladas", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "outdoor", nombre: "Outdoor", tag: "Aire libre", duracionMin: 60, precio: 0, cupoMax: 8 },
    });
    await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 8, cancelada: true },
    });

    const { GET } = await import("../../app/api/clases/route");
    const res = await GET(new Request(`http://localhost/api/clases?servicioId=${servicio.id}`));
    const body = await res.json();

    expect(body.clases).toHaveLength(0);
  });

  it("con un slug inexistente devuelve clases vacias, nunca la lista completa sin filtrar (bug 1.6)", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 2 },
    });
    await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), cupoMax: 2 },
    });

    const { GET } = await import("../../app/api/clases/route");
    const res = await GET(new Request(`http://localhost/api/clases?slug=slug-que-no-existe`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clases).toEqual([]);
  });

  it("rechaza con 400 un rango de fechas mayor a 12 semanas (deuda 2.2)", async () => {
    const desde = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const hasta = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
    const { GET } = await import("../../app/api/clases/route");
    const res = await GET(new Request(`http://localhost/api/clases?desde=${desde}&hasta=${hasta}`));
    expect(res.status).toBe(400);
  });
});