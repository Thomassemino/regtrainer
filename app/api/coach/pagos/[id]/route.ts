import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/db";

export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  // Defensa en profundidad: proxy.ts ya protege /api/coach/*, esto vuelve a verificar acá
  // por si alguna vez se llama a este handler fuera de ese prefijo (spec §11).
  if (!session?.user || session.user.role !== "ADMIN") {
    return Response.json({ error: "No autorizado" }, { status: 403 });
  }

  const pago = await prisma.pago.findUnique({ where: { id } });
  if (!pago) {
    return Response.json({ error: "Pago no encontrado" }, { status: 404 });
  }
  if (pago.medio !== "EFECTIVO") {
    return Response.json({ error: "Solo se marcan manualmente los pagos en efectivo" }, { status: 400 });
  }

  await prisma.pago.update({ where: { id }, data: { estado: "APROBADO" } });
  return Response.json({ ok: true });
}