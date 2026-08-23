import { PreApproval } from "mercadopago";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { mpClient } from "../../../../lib/mercadopago/client";
import { logger } from "../../../../lib/logger";

export async function POST(_req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  const suscripcion = await prisma.suscripcion.findUnique({ where: { clienteId: cliente.id } });
  if (!suscripcion || suscripcion.estado !== "ACTIVA") {
    return Response.json({ error: "No tenés una mensualidad activa" }, { status: 404 });
  }

  if (suscripcion.mpPreapprovalId) {
    try {
      const preapproval = new PreApproval(mpClient);
      await preapproval.update({ id: suscripcion.mpPreapprovalId, body: { status: "cancelled" } });
    } catch (e) {
      logger.error({ err: e, suscripcionId: suscripcion.id }, "error cancelando preapproval en mercado pago");
      return Response.json({ error: "No pudimos cancelar la suscripción, intentá de nuevo" }, { status: 502 });
    }
  }

  await prisma.suscripcion.update({
    where: { id: suscripcion.id },
    data: { estado: "CANCELADA", canceladaEn: new Date() },
  });

  return Response.json({ ok: true });
}