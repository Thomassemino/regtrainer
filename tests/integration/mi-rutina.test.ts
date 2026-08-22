import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

vi.mock("../../lib/auth", () => ({ auth: vi.fn() }));

const CLIENTE_A_EMAIL = "mirutina-a@example.com";
const CLIENTE_B_EMAIL = "mirutina-b@example.com";
let clienteAId: string;
let clienteBUserId: string;
let clienteAUserId: string;
let programaId: string;
let bloqueId: string;
let bloqueOtroProgramaId: string;

beforeEach(async () => {
  await prisma.bloqueCompletado.deleteMany();
  await prisma.asignacionPrograma.deleteMany();
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.session.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({ data: { email: "mirutina-admin@example.com", passwordHash: "x", role: "ADMIN" } });
  const userA = await prisma.user.create({ data: { email: CLIENTE_A_EMAIL, passwordHash: await hashPassword("Password123"), role: "CLIENTE", emailVerified: new Date() } });
  const userB = await prisma.user.create({ data: { email: CLIENTE_B_EMAIL, passwordHash: await hashPassword("Password123"), role: "CLIENTE", emailVerified: new Date() } });
  const clienteA = await prisma.cliente.create({ data: { userId: userA.id, nombre: "Camila", iniciales: "CF", objetivo: "x" } });
  const clienteB = await prisma.cliente.create({ data: { userId: userB.id, nombre: "Martín", iniciales: "MD", objetivo: "x" } });
  clienteAId = clienteA.id;
  clienteBUserId = userB.id;
  clienteAUserId = userA.id;

  const programa = await prisma.programa.create({
    data: { nombre: "Fuerza & Motor", objetivo: "Fuerza", frecuencia: "5 días", semanas: 1, creadoPorId: admin.id, dias: { create: { diaSemana: 1, descanso: false } } },
    include: { dias: true },
  });
  programaId = programa.id;
  const bloque = await prisma.bloque.create({ data: { diaId: programa.dias[0].id, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Sentadilla", detalle: "5x3" } });
  bloqueId = bloque.id;
  await prisma.asignacionPrograma.create({ data: { programaId, clienteId: clienteAId } });

  const otroPrograma = await prisma.programa.create({
    data: { nombre: "Otro", objetivo: "x", frecuencia: "x", semanas: 1, creadoPorId: admin.id, dias: { create: { diaSemana: 1, descanso: false } } },
    include: { dias: true },
  });
  bloqueOtroProgramaId = (await prisma.bloque.create({ data: { diaId: otroPrograma.dias[0].id, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "X", detalle: "x" } })).id;
});

async function mockCliente(id: string) {
  const { auth } = await import("../../lib/auth");
  vi.mocked(auth).mockResolvedValue({ user: { id, role: "CLIENTE" } } as never);
}

describe("GET /api/cuenta/mi-rutina", () => {
  it("el cliente B (sin asignación) no ve el programa de la cliente A", async () => {
    await mockCliente(clienteBUserId);
    const { GET } = await import("../../app/api/cuenta/mi-rutina/route");
    const res = await GET();
    const body = await res.json();
    expect(body.asignacion).toBeNull();
  });

  it("la cliente A ve su propio programa asignado", async () => {
    await mockCliente(clienteAUserId);
    const { GET } = await import("../../app/api/cuenta/mi-rutina/route");
    const res = await GET();
    const body = await res.json();
    expect(body.asignacion.programa.id).toBe(programaId);
  });
});

describe("POST /api/cuenta/mi-rutina/completar", () => {
  it("marca un bloque propio como completado", async () => {
    await mockCliente(clienteAUserId);
    const { POST } = await import("../../app/api/cuenta/mi-rutina/completar/route");
    const req = new Request("http://localhost/api/cuenta/mi-rutina/completar", { method: "POST", body: JSON.stringify({ bloqueId, semana: 1 }) });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const completados = await prisma.bloqueCompletado.findMany({ where: { bloqueId } });
    expect(completados).toHaveLength(1);
  });

  it("rechaza marcar un bloque que no pertenece al programa asignado del cliente", async () => {
    await mockCliente(clienteAUserId);
    const { POST } = await import("../../app/api/cuenta/mi-rutina/completar/route");
    const req = new Request("http://localhost/api/cuenta/mi-rutina/completar", { method: "POST", body: JSON.stringify({ bloqueId: bloqueOtroProgramaId, semana: 1 }) });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });
});