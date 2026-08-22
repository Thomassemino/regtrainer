import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

vi.mock("../../lib/auth", () => ({ auth: vi.fn() }));

let adminId: string;
let programaId: string;
let cliente1Id: string;
let cliente2Id: string;

beforeEach(async () => {
  await prisma.asignacionPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: { email: "asignar-admin@example.com", passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });
  adminId = admin.id;
  const programa = await prisma.programa.create({
    data: { nombre: "Fuerza & Motor", objetivo: "Fuerza", frecuencia: "5 días", semanas: 4, creadoPorId: admin.id },
  });
  programaId = programa.id;

  const u1 = await prisma.user.create({ data: { email: "camila@example.com", passwordHash: "x", role: "CLIENTE" } });
  const u2 = await prisma.user.create({ data: { email: "martin@example.com", passwordHash: "x", role: "CLIENTE" } });
  cliente1Id = (await prisma.cliente.create({ data: { userId: u1.id, nombre: "Camila", iniciales: "CF", objetivo: "x" } })).id;
  cliente2Id = (await prisma.cliente.create({ data: { userId: u2.id, nombre: "Martín", iniciales: "MD", objetivo: "x" } })).id;
});

describe("POST /api/coach/programas/:id/asignar", () => {
  it("crea una AsignacionPrograma por cada cliente seleccionado con mensaje y tema, y pasa el programa a ASIGNADO", async () => {
    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: adminId, role: "ADMIN" } } as never);

    const { POST } = await import("../../app/api/coach/programas/[id]/asignar/route");
    const req = new Request(`http://localhost/api/coach/programas/${programaId}/asignar`, {
      method: "POST",
      body: JSON.stringify({
        clienteIds: [cliente1Id, cliente2Id],
        mensajePersonalizado: "Arrancamos el bloque nuevo.",
        temaPdf: "night",
      }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: programaId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.asignados).toBe(2);

    const asignaciones = await prisma.asignacionPrograma.findMany({ where: { programaId } });
    expect(asignaciones).toHaveLength(2);
    expect(asignaciones.every((a) => a.mensajePersonalizado === "Arrancamos el bloque nuevo." && a.temaPdf === "night")).toBe(true);

    const programa = await prisma.programa.findUniqueOrThrow({ where: { id: programaId } });
    expect(programa.estado).toBe("ASIGNADO");
  });
});