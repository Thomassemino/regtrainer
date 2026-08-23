import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ activa: false });
  }
  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ activa: false });
  }
  const suscripcion = await prisma.suscripcion.findUnique({ where: { clienteId: cliente.id } });
  return Response.json({ activa: suscripcion?.estado === "ACTIVA" });
}