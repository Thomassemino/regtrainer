import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

vi.mock("../../lib/auth", () => ({ auth: vi.fn() }));

const ADMIN_EMAIL = "reordenar-admin@example.com";
let adminId: string;
let diaAId: string;
let diaBId: string;
let bloque1: string;
let bloque2: string;
let bloque3: string;
let diaOtroProgramaId: string;

beforeEach(async () => {
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: ADMIN_EMAIL, passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });
  adminId = admin.id;

  const programa = await prisma.programa.create({
    data: {
      nombre: "Test", objetivo: "x", frecuencia: "x", semanas: 1, creadoPorId: admin.id,
      dias: { create: [{ diaSemana: 1, descanso: false }, { diaSemana: 2, descanso: false }] },
    },
    include: { dias: true },
  });
  diaAId = programa.dias[0].id;
  diaBId = programa.dias[1].id;

  const b1 = await prisma.bloque.create({ data: { diaId: diaAId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "B1", detalle: "x" } });
  const b2 = await prisma.bloque.create({ data: { diaId: diaAId, orden: 1, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "B2", detalle: "x" } });
  const b3 = await prisma.bloque.create({ data: { diaId: diaBId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "B3", detalle: "x" } });
  bloque1 = b1.id;
  bloque2 = b2.id;
  bloque3 = b3.id;

  const otroPrograma = await prisma.programa.create({
    data: { nombre: "Otro", objetivo: "x", frecuencia: "x", semanas: 1, creadoPorId: admin.id, dias: { create: { diaSemana: 3, descanso: false } } },
    include: { dias: true },
  });
  diaOtroProgramaId = otroPrograma.dias[0].id;
});

async function mockAdminSession() {
  const { auth } = await import("../../lib/auth");
  vi.mocked(auth).mockResolvedValue({ user: { id: adminId, role: "ADMIN" } } as never);
}

describe("PATCH /api/coach/dias/:diaId/reordenar", () => {
  it("reordena los bloques dentro del mismo día", async () => {
    await mockAdminSession();
    const { PATCH } = await import("../../app/api/coach/dias/[diaId]/reordenar/route");
    const req = new Request(`http://localhost/api/coach/dias/${diaAId}/reordenar`, {
      method: "PATCH",
      body: JSON.stringify({ bloqueIds: [bloque2, bloque1] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ diaId: diaAId }) });
    expect(res.status).toBe(200);

    const [b1, b2] = await Promise.all([
      prisma.bloque.findUniqueOrThrow({ where: { id: bloque1 } }),
      prisma.bloque.findUniqueOrThrow({ where: { id: bloque2 } }),
    ]);
    expect(b2.orden).toBe(0);
    expect(b1.orden).toBe(1);
  });

  it("mueve un bloque a otro día del mismo programa y recalcula el orden de origen", async () => {
    await mockAdminSession();
    const { PATCH } = await import("../../app/api/coach/dias/[diaId]/reordenar/route");
    const req = new Request(`http://localhost/api/coach/dias/${diaBId}/reordenar`, {
      method: "PATCH",
      body: JSON.stringify({ bloqueIds: [bloque3, bloque1], diaOrigenId: diaAId, ordenOrigen: [bloque2] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ diaId: diaBId }) });
    expect(res.status).toBe(200);

    const movido = await prisma.bloque.findUniqueOrThrow({ where: { id: bloque1 } });
    expect(movido.diaId).toBe(diaBId);
    expect(movido.orden).toBe(1);
    const restante = await prisma.bloque.findUniqueOrThrow({ where: { id: bloque2 } });
    expect(restante.diaId).toBe(diaAId);
    expect(restante.orden).toBe(0);
  });

  it("rechaza mezclar bloques de otro programa", async () => {
    await mockAdminSession();
    const { PATCH } = await import("../../app/api/coach/dias/[diaId]/reordenar/route");
    const bloqueOtro = await prisma.bloque.create({ data: { diaId: diaOtroProgramaId, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "X", detalle: "x" } });
    const req = new Request(`http://localhost/api/coach/dias/${diaAId}/reordenar`, {
      method: "PATCH",
      body: JSON.stringify({ bloqueIds: [bloque1, bloqueOtro.id] }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ diaId: diaAId }) });
    expect(res.status).toBe(400);
  });
});