import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/coach/guards";

export async function GET() {
  const check = await requireAdmin();
  if (check.error) return check.error;

  const clientes = await prisma.cliente.findMany({
    orderBy: { nombre: "asc" },
    include: {
      user: { select: { image: true } },
      asignaciones: {
        orderBy: { asignadoEn: "desc" },
        take: 1,
        include: { programa: true },
      },
    },
  });

  const filas = clientes.map((c) => {
    const vigente = c.asignaciones[0] ?? null;
    return {
      id: c.id,
      nombre: c.nombre,
      iniciales: c.iniciales,
      imagen: c.user.image,
      objetivo: c.objetivo,
      plan: c.plan,
      programaActual: vigente?.programa.nombre ?? "Sin asignar",
      programaEstado: vigente?.programa.estado ?? null,
      actualizadoEn: vigente?.asignadoEn ?? null,
    };
  });

  return Response.json({ clientes: filas });
}