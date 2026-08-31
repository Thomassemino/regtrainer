import { prisma } from "../../../lib/db";
import { centavosAPesos } from "../../../lib/dinero";

export async function GET() {
  const planes = await prisma.planPrecio.findMany({ orderBy: { orden: "asc" } });

  return Response.json({
    planes: planes.map((p) => ({
      id: p.slug,
      slug: p.slug,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: centavosAPesos(p.precio),
      unidad: p.unidad,
      badge: p.badge,
      feats: p.feats,
    })),
  });
}
