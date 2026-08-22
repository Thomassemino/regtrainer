import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

let diaId: string;

beforeEach(async () => {
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { email: "bloques-admin@example.com", passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });
  const programa = await prisma.programa.create({
    data: { nombre: "Test", objetivo: "x", frecuencia: "x", semanas: 4, creadoPorId: user.id, dias: { create: { diaSemana: 1, descanso: false } } },
    include: { dias: true },
  });
  diaId = programa.dias[0].id;
});

describe("crear bloque", () => {
  it("crea el bloque con una FilaSobrecarga por cada semana del programa", async () => {
    const bloque = await prisma.bloque.create({
      data: {
        diaId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Sentadilla trasera con barra", detalle: "5 × 3 · @ 80% 1RM",
        sobrecarga: {
          create: Array.from({ length: 4 }, (_, i) => ({ semana: i + 1, series: 4, reps: 6, pct: 70, descanso: "02:00" })),
        },
      },
      include: { sobrecarga: true },
    });
    expect(bloque.sobrecarga).toHaveLength(4);
  });
});

describe("editar bloque", () => {
  it("actualiza una fila puntual de sobrecarga sin tocar las demás", async () => {
    const bloque = await prisma.bloque.create({
      data: {
        diaId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Press banca", detalle: "5x4",
        sobrecarga: { create: [{ semana: 1, series: 4, reps: 6, pct: 70, descanso: "02:00" }, { semana: 2, series: 4, reps: 5, pct: 75, descanso: "02:00" }] },
      },
    });
    await prisma.filaSobrecarga.update({ where: { bloqueId_semana: { bloqueId: bloque.id, semana: 2 } }, data: { pct: 78 } });
    const filas = await prisma.filaSobrecarga.findMany({ where: { bloqueId: bloque.id }, orderBy: { semana: "asc" } });
    expect(filas[0].pct).toBe(70);
    expect(filas[1].pct).toBe(78);
  });
});

describe("borrar bloque", () => {
  it("borra el bloque y en cascada su sobrecarga", async () => {
    const bloque = await prisma.bloque.create({
      data: { diaId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "X", detalle: "x", sobrecarga: { create: { semana: 1, series: 4, reps: 6, pct: 70, descanso: "02:00" } } },
    });
    await prisma.bloque.delete({ where: { id: bloque.id } });
    const filas = await prisma.filaSobrecarga.findMany({ where: { bloqueId: bloque.id } });
    expect(filas).toHaveLength(0);
  });
});