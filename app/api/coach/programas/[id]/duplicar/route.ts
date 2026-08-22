import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";
import { duplicarPrograma } from "../../../../../../lib/rutinas/duplicar";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;

  const programa = await prisma.programa.findUnique({ where: { id } });
  if (!programa) {
    return Response.json({ error: "Programa no encontrado" }, { status: 404 });
  }

  const nuevoId = await prisma.$transaction((tx) => duplicarPrograma(tx, id, check.session.user.id));
  return Response.json({ id: nuevoId }, { status: 201 });
}