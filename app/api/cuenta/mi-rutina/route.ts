import { prisma } from "../../../../lib/db";
import { requireClienteActual } from "../../../../lib/coach/guards";

export async function GET() {
  const check = await requireClienteActual();
  if (check.error) return check.error;
  const { cliente } = check;

  const asignacion = await prisma.asignacionPrograma.findFirst({
    where: { clienteId: cliente.id },
    orderBy: { asignadoEn: "desc" },
    include: {
      programa: {
        include: {
          dias: {
            orderBy: { diaSemana: "asc" },
            include: { bloques: { orderBy: { orden: "asc" }, include: { sobrecarga: { orderBy: { semana: "asc" } } } } },
          },
        },
      },
    },
  });

  return Response.json({ asignacion: asignacion ?? null });
}