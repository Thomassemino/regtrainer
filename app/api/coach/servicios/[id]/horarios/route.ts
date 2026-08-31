import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";

const HorarioSchema = z.object({
  diaSemana: z.number().int().min(0).max(6),
  horaInicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM"),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;

  const parsed = HorarioSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const horario = await prisma.horarioRecurrente.create({
      data: { servicioId: id, diaSemana: parsed.data.diaSemana, horaInicio: parsed.data.horaInicio },
    });
    return Response.json({ horario }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return Response.json({ error: "Servicio no encontrado" }, { status: 404 });
    }
    throw e;
  }
}
