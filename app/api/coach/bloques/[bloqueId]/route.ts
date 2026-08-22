import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/coach/guards";

const FilaSchema = z.object({
  semana: z.number().int().min(1),
  series: z.number().int().min(1),
  reps: z.number().int().min(1),
  pct: z.number().int().min(1).max(100),
  descanso: z.string().min(1),
});

const ActualizarBloqueSchema = z.object({
  tipo: z.enum(["TRADICIONAL", "SECUENCIA", "SUPERSERIE", "EMOM", "POR_TIEMPO"]).optional(),
  foco: z.enum(["TECNICA", "RITMO", "MAXIMO_ESFUERZO"]).optional(),
  titulo: z.string().min(2).optional(),
  detalle: z.string().min(2).optional(),
  meta: z.string().nullable().optional(),
  sobrecarga: z.array(FilaSchema).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ bloqueId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { bloqueId } = await params;

  const parsed = ActualizarBloqueSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { sobrecarga, ...datos } = parsed.data;

  const existe = await prisma.bloque.findUnique({ where: { id: bloqueId } });
  if (!existe) {
    return Response.json({ error: "Bloque no encontrado" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(datos).length > 0) {
      await tx.bloque.update({ where: { id: bloqueId }, data: datos });
    }
    if (sobrecarga) {
      for (const fila of sobrecarga) {
        await tx.filaSobrecarga.upsert({
          where: { bloqueId_semana: { bloqueId, semana: fila.semana } },
          update: { series: fila.series, reps: fila.reps, pct: fila.pct, descanso: fila.descanso },
          create: { bloqueId, ...fila },
        });
      }
    }
  });

  const bloque = await prisma.bloque.findUniqueOrThrow({
    where: { id: bloqueId },
    include: { sobrecarga: { orderBy: { semana: "asc" } } },
  });
  return Response.json({ bloque });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ bloqueId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { bloqueId } = await params;

  await prisma.bloque.delete({ where: { id: bloqueId } }).catch(() => null);
  return Response.json({ ok: true });
}