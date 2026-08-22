import { z } from "zod";
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";
import { duplicarDia } from "../../../../../../lib/rutinas/duplicar";

const Schema = z.object({ destinoDiaId: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ diaId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { diaId } = await params;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { destinoDiaId } = parsed.data;

  const [origen, destino] = await Promise.all([
    prisma.diaPrograma.findUnique({ where: { id: diaId } }),
    prisma.diaPrograma.findUnique({ where: { id: destinoDiaId } }),
  ]);
  if (!origen || !destino) {
    return Response.json({ error: "Día no encontrado" }, { status: 404 });
  }
  if (origen.programaId !== destino.programaId) {
    return Response.json({ error: "Los días no pertenecen al mismo programa" }, { status: 400 });
  }

  await prisma.$transaction((tx) => duplicarDia(tx, diaId, destinoDiaId));
  return Response.json({ ok: true });
}