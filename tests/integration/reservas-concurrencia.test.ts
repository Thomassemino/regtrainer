import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { crearReservaConCupo } from "../../lib/reservas/crear";

async function crearClienteDemo(email: string) {
  const user = await prisma.user.create({
    data: { email, passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
  });
  return prisma.cliente.create({ data: { userId: user.id, nombre: email, iniciales: "XX", objetivo: "" } });
}

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.suscripcion.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.horarioRecurrente.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("crearReservaConCupo — concurrencia (spec §12)", () => {
  it("con cupoMax 1, de dos reservas simultáneas exactamente una queda CONFIRMADA y la otra LISTA_ESPERA", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 1 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 1 },
    });
    const clienteA = await crearClienteDemo("concurrencia-a@example.com");
    const clienteB = await crearClienteDemo("concurrencia-b@example.com");

    const [resA, resB] = await Promise.all([
      crearReservaConCupo({ clienteId: clienteA.id, claseId: clase.id, medio: null }),
      crearReservaConCupo({ clienteId: clienteB.id, claseId: clase.id, medio: null }),
    ]);

    const estados = [resA.estado, resB.estado].sort();
    expect(estados).toEqual(["CONFIRMADA", "LISTA_ESPERA"]);

    const confirmadas = await prisma.reserva.count({ where: { claseId: clase.id, estado: "CONFIRMADA" } });
    const listaEspera = await prisma.reserva.count({ where: { claseId: clase.id, estado: "LISTA_ESPERA" } });
    expect(confirmadas).toBe(1);
    expect(listaEspera).toBe(1);
  });

  it("con cupo de 8 y 10 reservas simultáneas, exactamente 8 quedan CONFIRMADA", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "musculacion", nombre: "Musculación", tag: "Fuerza", duracionMin: 75, precio: 0, cupoMax: 8 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 8 },
    });
    const clientes = await Promise.all(
      Array.from({ length: 10 }, (_, i) => crearClienteDemo(`carga-${i}@example.com`))
    );

    await Promise.all(
      clientes.map((c) => crearReservaConCupo({ clienteId: c.id, claseId: clase.id, medio: null }))
    );

    const confirmadas = await prisma.reserva.count({ where: { claseId: clase.id, estado: "CONFIRMADA" } });
    const listaEspera = await prisma.reserva.count({ where: { claseId: clase.id, estado: "LISTA_ESPERA" } });
    expect(confirmadas).toBe(8);
    expect(listaEspera).toBe(2);
  });
});