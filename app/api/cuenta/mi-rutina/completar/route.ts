import { z } from "zod";
import { prisma } from "../../../../../lib/db";
import { requireClienteActual } from "../../../../../lib/coach/guards";

const Schema = z.object({ bloqueId: z.string().min(1), semana: z.number().int().min(1) });

export async function POST(req: Request) {
  const check = await requireClienteActual();
  if (check.error) return check.error;
  const { cliente } = check;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { bloqueId, semana } = parsed.data;

  const asignacion = await prisma.asignacionPrograma.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { asignadoEn: "desc" },
    include: { programa: { include: { dias: { include: { bloques: true } } } } },
  });
  if (!asignacion) {
    return Response.json({ error: "No tenés un programa asignado" }, { status: 404 });
  }

  const bloquePertenece = asignacion.programa.dias.some((d) => d.bloques.some((b) => b.id === bloqueId));
  if (!bloquePertenece) {
    return Response.json({ error: "Ese bloque no pertenece a tu programa" }, { status: 403 });
  }

  await prisma.bloqueCompletado.upsert({
    where: { asignacionId_bloqueId_semana: { asignacionId: asignacion.id, bloqueId, semana } },
    update: {},
    create: { asignacionId: asignacion.id, bloqueId, semana },
  });

  return Response.json({ ok: true });
}