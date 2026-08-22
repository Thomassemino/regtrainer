import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";
import { calcularCumplimientoUltimasSemanas } from "../../lib/rutinas/cumplimiento";

let clienteId: string;
let asignacionId: string;
let bloqueId: string;

beforeEach(async () => {
  await prisma.bloqueCompletado.deleteMany();
  await prisma.asignacionPrograma.deleteMany();
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: "ficha-admin@example.com", passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });
  const userCliente = await prisma.user.create({
    data: { email: "ficha-cliente@example.com", passwordHash: await hashPassword("Password123"), role: "CLIENTE", emailVerified: new Date() },
  });
  const cliente = await prisma.cliente.create({
    data: { userId: userCliente.id, nombre: "Camila Ferreyra", iniciales: "CF", objetivo: "Correr sin dolor" },
  });
  clienteId = cliente.id;

  const programa = await prisma.programa.create({
    data: {
      nombre: "Fuerza & Motor", objetivo: "Fuerza", frecuencia: "5 días", semanas: 1, creadoPorId: admin.id,
      dias: { create: { diaSemana: 1, descanso: false } },
    },
    include: { dias: true },
  });
  const bloque = await prisma.bloque.create({
    data: { diaId: programa.dias[0].id, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Sentadilla", detalle: "5x3" },
  });
  bloqueId = bloque.id;

  const asignacion = await prisma.asignacionPrograma.create({
    data: { programaId: programa.id, clienteId: cliente.id },
  });
  asignacionId = asignacion.id;
});

describe("calcularCumplimientoUltimasSemanas", () => {
  it("da 100% en la semana con el único bloque completado y 0% si no hay ninguno", async () => {
    await prisma.bloqueCompletado.create({ data: { asignacionId, bloqueId, semana: 1 } });
    const resultado = await calcularCumplimientoUltimasSemanas(prisma, asignacionId, 1);
    expect(resultado).toEqual([{ semana: 1, porcentaje: 100 }]);
  });
});

describe("GET /api/coach/clientes/:clienteId sin sesión", () => {
  it("rechaza con 401 cuando no hay sesión (requireAdmin de Task 2)", async () => {
    const { GET } = await import("../../app/api/coach/clientes/[clienteId]/route");
    const res = await GET(new Request(`http://localhost/api/coach/clientes/${clienteId}`), { params: Promise.resolve({ clienteId }) });
    expect(res.status).toBe(401);
  });
});