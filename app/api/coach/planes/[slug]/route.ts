import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/coach/guards";
import { pesosACentavos, centavosAPesos } from "../../../../../lib/dinero";

const ActualizarPlanSchema = z.object({
  nombre: z.string().min(2).max(80).optional(),
  descripcion: z.string().max(300).optional(),
  precioPesos: z.number().int().min(0).max(10_000_000).optional(),
  unidad: z.string().min(1).max(60).optional(),
  badge: z.string().max(30).optional(),
  feats: z.array(z.string().max(80)).max(10).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { slug } = await params;

  const parsed = ActualizarPlanSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }
  const { precioPesos, ...resto } = parsed.data;

  try {
    const plan = await prisma.planPrecio.update({
      where: { slug },
      data: { ...resto, ...(precioPesos !== undefined ? { precio: pesosACentavos(precioPesos) } : {}) },
    });
    return Response.json({ plan: { ...plan, precioPesos: centavosAPesos(plan.precio) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return Response.json({ error: "Plan no encontrado" }, { status: 404 });
    }
    throw e;
  }
}
