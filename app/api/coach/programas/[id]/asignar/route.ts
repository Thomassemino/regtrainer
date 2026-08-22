import { z } from "zod";
import { prisma } from "../../../../../../lib/db";
import { requireAdmin } from "../../../../../../lib/coach/guards";

const AsignarSchema = z.object({
  clienteIds: z.array(z.string()).min(1),
  mensajePersonalizado: z.string().optional(),
  temaPdf: z.enum(["clean", "night", "pink"]).default("clean"),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { id: programaId } = await params;

  const parsed = AsignarSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { clienteIds, mensajePersonalizado, temaPdf } = parsed.data;

  const programa = await prisma.programa.findUnique({ where: { id: programaId } });
  if (!programa) {
    return Response.json({ error: "Programa no encontrado" }, { status: 404 });
  }

  await prisma.$transaction([
    ...clienteIds.map((clienteId) =>
      prisma.asignacionPrograma.upsert({
        where: { programaId_clienteId: { programaId, clienteId } },
        update: { mensajePersonalizado, temaPdf },
        create: { programaId, clienteId, mensajePersonalizado, temaPdf },
      }),
    ),
    prisma.programa.update({ where: { id: programaId }, data: { estado: "ASIGNADO" } }),
  ]);

  return Response.json({ ok: true, asignados: clienteIds.length });
}