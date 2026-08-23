import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/db";
import { cancelarReserva, NoAutorizadoError } from "../../../../../lib/reservas/cancelar";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  try {
    await cancelarReserva({ reservaId: id, clienteId: cliente.id });
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof NoAutorizadoError) {
      return Response.json({ error: "No autorizado" }, { status: 403 });
    }
    throw e;
  }
}