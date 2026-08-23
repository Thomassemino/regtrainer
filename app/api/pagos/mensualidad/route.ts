import { PreApproval } from "mercadopago";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { mpClient } from "../../../../lib/mercadopago/client";
import { centavosAPesos } from "../../../../lib/dinero";
import { logger } from "../../../../lib/logger";

const PRECIO_MENSUALIDAD_CENTAVOS = 15000000;

export async function POST(_req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id }, include: { user: true } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  const existente = await prisma.suscripcion.findUnique({ where: { clienteId: cliente.id } });
  if (existente && existente.estado === "ACTIVA") {
    return Response.json({ error: "Ya tenés una mensualidad activa" }, { status: 409 });
  }

  try {
    const preapproval = new PreApproval(mpClient);
    const resultado = await preapproval.create({
      body: {
        reason: "Mensualidad Beto Training",
        external_reference: cliente.id,
        payer_email: cliente.user.email,
        back_url: `${process.env.NEXTAUTH_URL}/?screen=cuenta`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: centavosAPesos(PRECIO_MENSUALIDAD_CENTAVOS),
          currency_id: "ARS",
        },
      },
    });

    const suscripcion = await prisma.suscripcion.upsert({
      where: { clienteId: cliente.id },
      update: {
        estado: "ACTIVA",
        precio: PRECIO_MENSUALIDAD_CENTAVOS,
        fechaInicio: new Date(),
        fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        mpPreapprovalId: resultado.id,
        canceladaEn: null,
      },
      create: {
        clienteId: cliente.id,
        precio: PRECIO_MENSUALIDAD_CENTAVOS,
        fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        mpPreapprovalId: resultado.id,
      },
    });

    return Response.json({ initPoint: resultado.init_point, suscripcionId: suscripcion.id }, { status: 201 });
  } catch (e) {
    logger.error({ err: e }, "error creando preapproval de mercado pago");
    return Response.json({ error: "No pudimos iniciar la suscripción, intentá de nuevo" }, { status: 502 });
  }
}