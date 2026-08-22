import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/coach/guards";

const ActualizarDiaSchema = z.object({
  descanso: z.boolean().optional(),
  calentamiento: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ diaId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { diaId } = await params;

  const parsed = ActualizarDiaSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const dia = await prisma.diaPrograma.update({ where: { id: diaId }, data: parsed.data }).catch(() => null);
  if (!dia) {
    return Response.json({ error: "Día no encontrado" }, { status: 404 });
  }
  return Response.json({ dia });
}