import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

let adminId: string;
let programaId: string;
let diaOrigenId: string;
let diaDestinoId: string;

beforeEach(async () => {
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.asignacionPrograma.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: "duplicar-admin@example.com", passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });
  adminId = admin.id;

  const programa = await prisma.programa.create({
    data: {
      nombre: "Fuerza & Motor", objetivo: "Fuerza", frecuencia: "5 días", semanas: 2, creadoPorId: admin.id,
      dias: { create: [{ diaSemana: 1, descanso: false }, { diaSemana: 2, descanso: false }] },
    },
    include: { dias: true },
  });
  programaId = programa.id;
  diaOrigenId = programa.dias[0].id;
  diaDestinoId = programa.dias[1].id;

  await prisma.bloque.create({
    data: {
      diaId: diaOrigenId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Sentadilla", detalle: "5x3",
      sobrecarga: { create: [{ semana: 1, series: 4, reps: 6, pct: 70, descanso: "02:00" }, { semana: 2, series: 4, reps: 5, pct: 75, descanso: "02:00" }] },
    },
  });
  await prisma.bloque.create({
    data: { diaId: diaDestinoId, orden: 0, tipo: "SECUENCIA", foco: "RITMO", titulo: "Viejo contenido", detalle: "x" },
  });
});

describe("duplicarDia", () => {
  it("reemplaza el contenido del día destino y preserva la sobrecarga del origen", async () => {
    const { duplicarDia } = await import("../../lib/rutinas/duplicar");
    await prisma.$transaction((tx) => duplicarDia(tx, diaOrigenId, diaDestinoId));

    const bloquesDestino = await prisma.bloque.findMany({ where: { diaId: diaDestinoId }, include: { sobrecarga: true } });
    expect(bloquesDestino).toHaveLength(1);
    expect(bloquesDestino[0].titulo).toBe("Sentadilla");
    expect(bloquesDestino[0].sobrecarga).toHaveLength(2);
  });
});

describe("duplicarPrograma", () => {
  it("clona dias, bloques y sobrecarga completos sin arrastrar asignaciones", async () => {
    await prisma.asignacionPrograma.create({
      data: {
        programaId,
        clienteId: (
          await prisma.cliente.create({
            data: {
              userId: (await prisma.user.create({ data: { email: "cliente-dup@example.com", passwordHash: "x", role: "CLIENTE" } })).id,
              nombre: "Test", iniciales: "TT", objetivo: "x",
            },
          })
        ).id,
      },
    });

    const { duplicarPrograma } = await import("../../lib/rutinas/duplicar");
    const nuevoId = await prisma.$transaction((tx) => duplicarPrograma(tx, programaId, adminId));

    const copia = await prisma.programa.findUniqueOrThrow({
      where: { id: nuevoId },
      include: { dias: { include: { bloques: { include: { sobrecarga: true } } } }, asignaciones: true },
    });
    expect(copia.nombre).toBe("Fuerza & Motor (copia)");
    expect(copia.estado).toBe("BORRADOR");
    expect(copia.asignaciones).toHaveLength(0);
    expect(copia.dias).toHaveLength(2);
    const totalBloques = copia.dias.reduce((acc, d) => acc + d.bloques.length, 0);
    expect(totalBloques).toBe(2);
  });
});