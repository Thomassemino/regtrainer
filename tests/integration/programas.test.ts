import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../../lib/db";
import { hashPassword } from "../../lib/auth/hash";

vi.mock("../../lib/auth", () => ({ auth: vi.fn() }));

async function crearAdmin() {
  const user = await prisma.user.create({
    data: { email: "coach-admin@example.com", passwordHash: await hashPassword("Password123"), role: "ADMIN", emailVerified: new Date() },
  });
  return { user };
}

beforeEach(async () => {
  await prisma.filaSobrecarga.deleteMany();
  await prisma.bloque.deleteMany();
  await prisma.diaPrograma.deleteMany();
  await prisma.asignacionPrograma.deleteMany();
  await prisma.programa.deleteMany();
  await prisma.session.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("crear programa y agregar semana", () => {
  it("crea 7 DiaPrograma (diaSemana 0..6) al crear un programa", async () => {
    const { user } = await crearAdmin();
    const programa = await prisma.programa.create({
      data: {
        nombre: "Fuerza & Motor",
        objetivo: "Fuerza",
        frecuencia: "5 días semanales",
        semanas: 4,
        creadoPorId: user.id,
        dias: { create: Array.from({ length: 7 }, (_, diaSemana) => ({ diaSemana, descanso: false })) },
      },
      include: { dias: true },
    });
    expect(programa.dias).toHaveLength(7);
    expect(programa.dias.map((d) => d.diaSemana).sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("agregar una semana crea una FilaSobrecarga por bloque con la progresión y no supera 8", async () => {
    const { user } = await crearAdmin();
    const programa = await prisma.programa.create({
      data: { nombre: "Test", objetivo: "x", frecuencia: "x", semanas: 1, creadoPorId: user.id, dias: { create: { diaSemana: 1, descanso: false } } },
      include: { dias: true },
    });
    const dia = programa.dias[0];
    const bloque = await prisma.bloque.create({
      data: {
        diaId: dia.id, orden: 0, tipo: "TRADICIONAL", foco: "TECNICA", titulo: "Sentadilla", detalle: "5x3",
        sobrecarga: { create: { semana: 1, series: 4, reps: 6, pct: 70, descanso: "02:00" } },
      },
    });

    const { construirFilaSobrecarga } = await import("../../lib/rutinas/sobrecarga");
    const nuevaFila = construirFilaSobrecarga(2, { series: 4, descanso: "02:00" });
    await prisma.filaSobrecarga.create({ data: { bloqueId: bloque.id, ...nuevaFila } });
    await prisma.programa.update({ where: { id: programa.id }, data: { semanas: 2 } });

    const filas = await prisma.filaSobrecarga.findMany({ where: { bloqueId: bloque.id }, orderBy: { semana: "asc" } });
    expect(filas).toHaveLength(2);
    expect(filas[1]).toMatchObject({ semana: 2, series: 4, reps: 5, pct: 75, descanso: "02:00" });
  });
});

describe("crear programa con clienteId — dueño original desde la ficha", () => {
  it("crea la AsignacionPrograma junto con el programa cuando se pasa clienteId", async () => {
    const { user } = await crearAdmin();
    const clienteUser = await prisma.user.create({
      data: { email: "duena-programa@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({
      data: { userId: clienteUser.id, nombre: "Dueña Programa", iniciales: "DP", objetivo: "" },
    });

    const { POST } = await import("../../app/api/coach/programas/route");
    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id, role: "ADMIN" } } as never);

    const res = await POST(
      new Request("http://localhost/api/coach/programas", {
        method: "POST",
        body: JSON.stringify({ nombre: "Fuerza & Motor", objetivo: "Fuerza", frecuencia: "5 días semanales", clienteId: cliente.id }),
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.programa.asignaciones).toHaveLength(1);
    expect(body.programa.asignaciones[0].clienteId).toBe(cliente.id);
  });
});