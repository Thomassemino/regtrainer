import { z } from "zod";
import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/coach/guards";

const CrearProgramaSchema = z.object({
  nombre: z.string().min(2),
  objetivo: z.string().min(2),
  frecuencia: z.string().min(2),
  semanas: z.number().int().min(2).max(8).default(4),
  clienteId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const parsed = CrearProgramaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { nombre, objetivo, frecuencia, semanas, clienteId } = parsed.data;

  if (clienteId) {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
    if (!cliente) {
      return Response.json({ error: "Cliente no encontrado" }, { status: 404 });
    }
  }

  const programa = await prisma.programa.create({
    data: {
      nombre,
      objetivo,
      frecuencia,
      semanas,
      creadoPorId: check.session.user.id,
      dias: {
        create: Array.from({ length: 7 }, (_, diaSemana) => ({ diaSemana, descanso: false })),
      },
      ...(clienteId
        ? { asignaciones: { create: { clienteId, mensajePersonalizado: null } } }
        : {}),
    },
    include: { dias: { orderBy: { diaSemana: "asc" } }, asignaciones: true },
  });

  return Response.json({ programa }, { status: 201 });
}