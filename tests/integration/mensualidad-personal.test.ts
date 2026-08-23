import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { cubreMensualidad } from "../../lib/reservas/mensualidad";

let clienteId: string;
let servicioPersonalId: string;

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.suscripcion.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { email: "mensual@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
  });
  const cliente = await prisma.cliente.create({
    data: { userId: user.id, nombre: "Mensual Test", iniciales: "MT", objetivo: "" },
  });
  clienteId = cliente.id;

  const servicio = await prisma.servicio.create({
    data: { slug: "personal", nombre: "Personalizado 1 a 1", tag: "Estrella", duracionMin: 60, precio: 2200000, cupoMax: 1 },
  });
  servicioPersonalId = servicio.id;

  await prisma.suscripcion.create({
    data: { clienteId, estado: "ACTIVA", precio: 15000000, fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  });
});

describe("cubreMensualidad — una CANCELADA sigue cubriendo hasta fechaProximoCobro (spec §7.2.5)", () => {
  it("cubre mientras fechaProximoCobro sea futura, aunque el estado sea CANCELADA", async () => {
    await prisma.suscripcion.update({
      where: { clienteId },
      data: { estado: "CANCELADA", canceladaEn: new Date(), fechaProximoCobro: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
    });
    const servicio = await prisma.servicio.findUniqueOrThrow({ where: { id: servicioPersonalId } });
    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicio);
    expect(cubierta).toBe(true);
  });

  it("no cubre una vez pasada fechaProximoCobro estando CANCELADA", async () => {
    await prisma.suscripcion.update({
      where: { clienteId },
      data: { estado: "CANCELADA", canceladaEn: new Date(), fechaProximoCobro: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    const servicio = await prisma.servicio.findUniqueOrThrow({ where: { id: servicioPersonalId } });
    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicio);
    expect(cubierta).toBe(false);
  });

  it("no cubre en absoluto si está VENCIDA (cobro fallido corta de inmediato)", async () => {
    await prisma.suscripcion.update({
      where: { clienteId },
      data: { estado: "VENCIDA", fechaProximoCobro: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
    });
    const servicio = await prisma.servicio.findUniqueOrThrow({ where: { id: servicioPersonalId } });
    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicio);
    expect(cubierta).toBe(false);
  });
});

describe("cubreMensualidad — regla de 1 personalizada por semana", () => {
  it("cubre la primera reserva de personal de la semana", async () => {
    const servicio = await prisma.servicio.findUniqueOrThrow({ where: { id: servicioPersonalId } });
    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicio);
    expect(cubierta).toBe(true);
  });

  it("no cubre la segunda reserva de personal en la misma semana calendario", async () => {
    const servicio = await prisma.servicio.findUniqueOrThrow({ where: { id: servicioPersonalId } });
    const clase1 = await prisma.clase.create({
      data: { servicioId: servicioPersonalId, fecha: new Date("2026-08-18T09:00:00.000Z"), cupoMax: 1 },
    });
    await prisma.reserva.create({
      data: { clienteId, claseId: clase1.id, estado: "CONFIRMADA", viaMensualidad: true },
    });

    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicio);
    expect(cubierta).toBe(false);
  });

  it("una reserva de personal en LISTA_ESPERA no cuenta contra el límite semanal (bug corregido en Judgment Day)", async () => {
    const servicio = await prisma.servicio.findUniqueOrThrow({ where: { id: servicioPersonalId } });
    const clase1 = await prisma.clase.create({
      data: { servicioId: servicioPersonalId, fecha: new Date("2026-08-18T09:00:00.000Z"), cupoMax: 1 },
    });
    await prisma.reserva.create({
      data: { clienteId, claseId: clase1.id, estado: "LISTA_ESPERA", viaMensualidad: true },
    });

    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicio);
    expect(cubierta).toBe(true);
  });

  it("una reserva de personal cancelada no cuenta contra el límite semanal", async () => {
    const servicio = await prisma.servicio.findUniqueOrThrow({ where: { id: servicioPersonalId } });
    const clase1 = await prisma.clase.create({
      data: { servicioId: servicioPersonalId, fecha: new Date("2026-08-18T09:00:00.000Z"), cupoMax: 1 },
    });
    await prisma.reserva.create({
      data: { clienteId, claseId: clase1.id, estado: "CANCELADA", viaMensualidad: true, canceladaEn: new Date() },
    });

    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicio);
    expect(cubierta).toBe(true);
  });

  it("una Suscripcion en VENCIDA no da cobertura (bug 1.2: cobro recurrente fallido)", async () => {
    const servicio = await prisma.servicio.findUniqueOrThrow({ where: { id: servicioPersonalId } });
    await prisma.suscripcion.update({ where: { clienteId }, data: { estado: "VENCIDA" } });
    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicio);
    expect(cubierta).toBe(false);
  });

  it("una Suscripcion CANCELADA sigue dando cobertura en un servicio grupal mientras no venza fechaProximoCobro (spec §7.2.5)", async () => {
    const servicioGrupal = await prisma.servicio.create({
      data: { slug: "funcional-v", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 1200000, cupoMax: 8 },
    });
    // fechaProximoCobro del beforeEach queda en +30 días — todavía no venció el período ya pago.
    await prisma.suscripcion.update({ where: { clienteId }, data: { estado: "CANCELADA", canceladaEn: new Date() } });
    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicioGrupal);
    expect(cubierta).toBe(true);
  });

  it("una Suscripcion CANCELADA ya no cubre un servicio grupal una vez vencido fechaProximoCobro", async () => {
    const servicioGrupal = await prisma.servicio.create({
      data: { slug: "funcional-w", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 1200000, cupoMax: 8 },
    });
    await prisma.suscripcion.update({
      where: { clienteId },
      data: { estado: "CANCELADA", canceladaEn: new Date(), fechaProximoCobro: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });
    const { cubierta } = await cubreMensualidad(prisma, clienteId, servicioGrupal);
    expect(cubierta).toBe(false);
  });
});