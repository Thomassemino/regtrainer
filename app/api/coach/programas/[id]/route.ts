import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/coach/guards";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;

  const programa = await prisma.programa.findUnique({
    where: { id },
    include: {
      dias: {
        orderBy: { diaSemana: "asc" },
        include: { bloques: { orderBy: { orden: "asc" }, include: { sobrecarga: { orderBy: { semana: "asc" } } } } },
      },
      asignaciones: { include: { cliente: true } },
    },
  });
  if (!programa) {
    return Response.json({ error: "Programa no encontrado" }, { status: 404 });
  }
  return Response.json({ programa });
}