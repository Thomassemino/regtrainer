import { z } from "zod";
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";

const ReordenarSchema = z.object({
  bloqueIds: z.array(z.string()).min(1),
  diaOrigenId: z.string().optional(),
  ordenOrigen: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ diaId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { diaId: diaDestinoId } = await params;

  const parsed = ReordenarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { bloqueIds, diaOrigenId, ordenOrigen } = parsed.data;

  const diaDestino = await prisma.diaPrograma.findUnique({ where: { id: diaDestinoId } });
  if (!diaDestino) {
    return Response.json({ error: "Día no encontrado" }, { status: 404 });
  }

  if (diaOrigenId && diaOrigenId !== diaDestinoId) {
    const diaOrigen = await prisma.diaPrograma.findUnique({ where: { id: diaOrigenId } });
    if (!diaOrigen || diaOrigen.programaId !== diaDestino.programaId) {
      return Response.json({ error: "El día de origen no pertenece al mismo programa" }, { status: 400 });
    }
  }

  const idsAValidar = [...bloqueIds, ...(ordenOrigen ?? [])];
  const bloquesExistentes = await prisma.bloque.findMany({
    where: { id: { in: idsAValidar } },
    include: { dia: true },
  });
  const perteneceAlPrograma = bloquesExistentes.every((b) => b.dia.programaId === diaDestino.programaId);
  if (bloquesExistentes.length !== idsAValidar.length || !perteneceAlPrograma) {
    return Response.json({ error: "Uno o más bloques no pertenecen a este programa" }, { status: 400 });
  }

  await prisma.$transaction([
    ...bloqueIds.map((bloqueId, index) =>
      prisma.bloque.update({ where: { id: bloqueId }, data: { diaId: diaDestinoId, orden: index } }),
    ),
    ...(ordenOrigen ?? []).map((bloqueId, index) =>
      prisma.bloque.update({ where: { id: bloqueId }, data: { orden: index } }),
    ),
  ]);

  return Response.json({ ok: true });
}