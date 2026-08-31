import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/coach/guards";
import { centavosAPesos } from "../../../../lib/dinero";

export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const planes = await prisma.planPrecio.findMany({ orderBy: { orden: "asc" } });
  return Response.json({ planes: planes.map((p) => ({ ...p, precioPesos: centavosAPesos(p.precio) })) });
}
