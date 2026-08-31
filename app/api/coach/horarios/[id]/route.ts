import { Prisma } from "@prisma/client";
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/coach/guards";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;

  try {
    await prisma.horarioRecurrente.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return Response.json({ error: "Horario no encontrado" }, { status: 404 });
    }
    throw e;
  }
}
