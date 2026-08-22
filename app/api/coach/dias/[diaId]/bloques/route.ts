import { z } from "zod";
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";
import { construirTablaSobrecarga } from "../../../../../../lib/rutinas/sobrecarga";

const CrearBloqueSchema = z.object({
  tipo: z.enum(["TRADICIONAL", "SECUENCIA", "SUPERSERIE", "EMOM", "POR_TIEMPO"]),
  foco: z.enum(["TECNICA", "RITMO", "MAXIMO_ESFUERZO"]),
  titulo: z.string().min(2),
  detalle: z.string().min(2),
  meta: z.string().optional(),
  seriesBase: z.number().int().min(1),
  descansoBase: z.string().min(1),
});

export async function POST(req: Request, { params }: { params: Promise<{ diaId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { diaId } = await params;

  const dia = await prisma.diaPrograma.findUnique({
    where: { id: diaId },
    include: { programa: true, _count: { select: { bloques: true } } },
  });
  if (!dia) {
    return Response.json({ error: "Día no encontrado" }, { status: 404 });
  }

  const parsed = CrearBloqueSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { seriesBase, descansoBase, ...datos } = parsed.data;

  const bloque = await prisma.bloque.create({
    data: {
      ...datos,
      diaId,
      orden: dia._count.bloques,
      sobrecarga: {
        create: construirTablaSobrecarga(dia.programa.semanas, { series: seriesBase, descanso: descansoBase }),
      },
    },
    include: { sobrecarga: { orderBy: { semana: "asc" } } },
  });

  return Response.json({ bloque }, { status: 201 });
}