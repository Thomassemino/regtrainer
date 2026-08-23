import { prisma } from "../../../../../lib/db";
import { requireAdmin } from "../../../../../lib/coach/guards";
import { calcularCumplimientoUltimasSemanas } from "../../../../../lib/rutinas/cumplimiento";
import { calcularSemanaActual } from "../../../../../lib/rutinas/semana-actual";

export async function GET(_req: Request, { params }: { params: Promise<{ clienteId: string }> }) {
  const check = await requireAdmin();
  if (check.error) return check.error;
  const { clienteId } = await params;

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: {
      asignaciones: {
        orderBy: { asignadoEn: "desc" },
        include: { programa: true },
      },
    },
  });
  if (!cliente) {
    return Response.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const asignacionActiva = cliente.asignaciones[0] ?? null;
  const cumplimiento = asignacionActiva
    ? await calcularCumplimientoUltimasSemanas(
        prisma,
        asignacionActiva.id,
        calcularSemanaActual(asignacionActiva.asignadoEn, asignacionActiva.programa.semanas),
      )
    : [];

  return Response.json({ cliente, cumplimiento });
}