import { prisma } from "../../../lib/db";
import { centavosAPesos } from "../../../lib/dinero";

export async function GET() {
  const servicios = await prisma.servicio.findMany({
    where: { activo: true },
    orderBy: { precio: "desc" },
    include: { horarios: { where: { activo: true }, orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }] } },
  });

  return Response.json({
    servicios: servicios.map((s) => ({
      id: s.slug,
      slug: s.slug,
      nombre: s.nombre,
      tag: s.tag,
      descripcion: s.descripcion,
      imagenUrl: s.imagenUrl,
      duracionMin: s.duracionMin,
      precio: centavosAPesos(s.precio),
      cupoMax: s.cupoMax,
      horarios: s.horarios.map((h) => ({ id: h.id, diaSemana: h.diaSemana, horaInicio: h.horaInicio })),
    })),
  });
}
