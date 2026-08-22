import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";
import { construirFilaSobrecarga } from "../../../../../../lib/rutinas/sobrecarga";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id } = await params;

  const programa = await prisma.programa.findUnique({
    where: { id },
    include: { dias: { include: { bloques: { include: { sobrecarga: { orderBy: { semana: "asc" } } } } } } },
  });
  if (!programa) {
    return Response.json({ error: "Programa no encontrado" }, { status: 404 });
  }
  if (programa.semanas >= 8) {
    return Response.json({ error: "El mesociclo ya tiene el máximo de 8 semanas" }, { status: 400 });
  }

  const nuevaSemana = programa.semanas + 1;
  const bloques = programa.dias.flatMap((d) => d.bloques);

  await prisma.$transaction([
    ...bloques.map((bloque) => {
      const base = bloque.sobrecarga.find((f) => f.semana === 1) ?? bloque.sobrecarga[0];
      const fila = construirFilaSobrecarga(nuevaSemana, {
        series: base?.series ?? 4,
        descanso: base?.descanso ?? "02:00",
      });
      return prisma.filaSobrecarga.create({ data: { bloqueId: bloque.id, ...fila } });
    }),
    prisma.programa.update({ where: { id }, data: { semanas: nuevaSemana } }),
  ]);

  const actualizado = await prisma.programa.findUniqueOrThrow({ where: { id } });
  return Response.json({ programa: actualizado });
}