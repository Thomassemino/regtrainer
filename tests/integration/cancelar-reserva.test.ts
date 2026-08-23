import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { cancelarReserva } from "../../lib/reservas/cancelar";

async function crearClienteDemo(email: string) {
  const user = await prisma.user.create({
    data: { email, passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
  });
  return prisma.cliente.create({ data: { userId: user.id, nombre: email, iniciales: "XX", objetivo: "" } });
}

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("cancelarReserva", () => {
  it("cancelar con 13hs de anticipación libera cupo y promueve la lista de espera", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 1 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 13 * 60 * 60 * 1000), cupoMax: 1 },
    });
    const clienteA = await crearClienteDemo("cancela-13hs-a@example.com");
    const clienteB = await crearClienteDemo("cancela-13hs-b@example.com");

    const reservaA = await prisma.reserva.create({ data: { clienteId: clienteA.id, claseId: clase.id, estado: "CONFIRMADA" } });
    const reservaB = await prisma.reserva.create({ data: { clienteId: clienteB.id, claseId: clase.id, estado: "LISTA_ESPERA" } });

    await cancelarReserva({ reservaId: reservaA.id, clienteId: clienteA.id });

    const actualizadaA = await prisma.reserva.findUniqueOrThrow({ where: { id: reservaA.id } });
    const actualizadaB = await prisma.reserva.findUniqueOrThrow({ where: { id: reservaB.id } });
    expect(actualizadaA.estado).toBe("CANCELADA");
    expect(actualizadaA.canceladaTarde).toBe(false);
    expect(actualizadaB.estado).toBe("CONFIRMADA");
  });

  it("cancelar con 6hs de anticipación no reembolsa un pago aprobado", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "personal", nombre: "Personalizado 1 a 1", tag: "Estrella", duracionMin: 60, precio: 2200000, cupoMax: 1 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 6 * 60 * 60 * 1000), cupoMax: 1 },
    });
    const cliente = await crearClienteDemo("cancela-6hs@example.com");
    const pago = await prisma.pago.create({
      data: { clienteId: cliente.id, tipo: "CLASE_SUELTA", medio: "MERCADO_PAGO", monto: 2200000, estado: "APROBADO" },
    });
    const reserva = await prisma.reserva.create({
      data: { clienteId: cliente.id, claseId: clase.id, estado: "CONFIRMADA", pagoId: pago.id },
    });

    await cancelarReserva({ reservaId: reserva.id, clienteId: cliente.id });

    const reservaActualizada = await prisma.reserva.findUniqueOrThrow({ where: { id: reserva.id } });
    const pagoActualizado = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
    expect(reservaActualizada.canceladaTarde).toBe(true);
    expect(pagoActualizado.estado).toBe("APROBADO");
  });

  it("rechaza cancelar la reserva de otro cliente", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 8 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 8 },
    });
    const dueño = await crearClienteDemo("dueño@example.com");
    const intruso = await crearClienteDemo("intruso@example.com");
    const reserva = await prisma.reserva.create({ data: { clienteId: dueño.id, claseId: clase.id, estado: "CONFIRMADA" } });

    await expect(cancelarReserva({ reservaId: reserva.id, clienteId: intruso.id })).rejects.toThrow(/No autorizado/);
  });
});