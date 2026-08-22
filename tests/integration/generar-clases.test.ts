import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { ensureClasesGeneradas } from "../../lib/clases/generar";

beforeEach(async () => {
  await prisma.reserva.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.horarioRecurrente.deleteMany();
  await prisma.servicio.deleteMany();
});

describe("ensureClasesGeneradas", () => {
  it("genera instancias de Clase para los próximos días que coinciden con el diaSemana del horario", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 0, cupoMax: 8 },
    });
    const ahora = new Date("2026-08-24T00:00:00.000Z");
    await prisma.horarioRecurrente.create({
      data: { servicioId: servicio.id, diaSemana: 2, horaInicio: "19:00" },
    });

    await ensureClasesGeneradas(ahora);

    const clases = await prisma.clase.findMany({ where: { servicioId: servicio.id }, orderBy: { fecha: "asc" } });
    expect(clases.length).toBeGreaterThan(0);
    for (const c of clases) {
      expect(c.fecha.getUTCDay()).toBe(2);
      expect(c.fecha.getUTCHours()).toBe(19);
      expect(c.cupoMax).toBe(8);
    }
  });

  it("es idempotente: correrlo dos veces no duplica clases", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "outdoor", nombre: "Outdoor", tag: "Aire libre", duracionMin: 60, precio: 0, cupoMax: 8 },
    });
    await prisma.horarioRecurrente.create({
      data: { servicioId: servicio.id, diaSemana: 2, horaInicio: "07:00" },
    });
    const ahora = new Date("2026-08-24T00:00:00.000Z");

    await ensureClasesGeneradas(ahora);
    const primeraCorrida = await prisma.clase.count({ where: { servicioId: servicio.id } });

    await ensureClasesGeneradas(ahora);
    const segundaCorrida = await prisma.clase.count({ where: { servicioId: servicio.id } });

    expect(segundaCorrida).toBe(primeraCorrida);
  });

  it("no genera clases para HorarioRecurrente inactivo", async () => {
    const servicio = await prisma.servicio.create({
      data: { slug: "musculacion", nombre: "Musculación", tag: "Fuerza", duracionMin: 75, precio: 0, cupoMax: 8 },
    });
    await prisma.horarioRecurrente.create({
      data: { servicioId: servicio.id, diaSemana: 2, horaInicio: "18:00", activo: false },
    });

    await ensureClasesGeneradas(new Date("2026-08-24T00:00:00.000Z"));

    const clases = await prisma.clase.count({ where: { servicioId: servicio.id } });
    expect(clases).toBe(0);
  });
});