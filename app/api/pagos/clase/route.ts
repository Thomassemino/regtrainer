import { z } from "zod";
import { Preference } from "mercadopago";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { mpClient } from "../../../../lib/mercadopago/client";
import { centavosAPesos } from "../../../../lib/dinero";
import { logger } from "../../../../lib/logger";

const Schema = z.object({ claseId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  const clase = await prisma.clase.findUnique({
    where: { id: parsed.data.claseId },
    include: { servicio: true },
  });
  if (!clase || clase.cancelada) {
    return Response.json({ error: "Clase no encontrada" }, { status: 404 });
  }
  if (clase.servicio.precio === 0) {
    return Response.json({ error: "Este servicio no requiere pago, reservá directo en POST /api/reservas" }, { status: 400 });
  }

  const pago = await prisma.pago.create({
    data: {
      clienteId: cliente.id,
      tipo: "CLASE_SUELTA",
      medio: "MERCADO_PAGO",
      monto: clase.servicio.precio,
      estado: "PENDIENTE",
    },
  });

  try {
    const preference = new Preference(mpClient);
    const resultado = await preference.create({
      body: {
        items: [
          {
            id: String(clase.servicio.id),
            title: clase.servicio.nombre,
            quantity: 1,
            unit_price: centavosAPesos(clase.servicio.precio),
            currency_id: "ARS",
          },
        ],
        external_reference: JSON.stringify({ pagoId: pago.id, claseId: clase.id }),
        notification_url: `${process.env.NEXTAUTH_URL}/api/webhooks/mercadopago`,
        back_urls: {
          success: `${process.env.NEXTAUTH_URL}/?screen=confirm&pago=${pago.id}`,
          failure: `${process.env.NEXTAUTH_URL}/?screen=checkout&error=pago_rechazado`,
          pending: `${process.env.NEXTAUTH_URL}/?screen=checkout&pago=pendiente`,
        },
        auto_return: "approved",
      },
    });

    return Response.json({ initPoint: resultado.init_point, pagoId: pago.id }, { status: 201 });
  } catch (e) {
    logger.error({ err: e }, "error creando preferencia de mercado pago");
    await prisma.pago.update({ where: { id: pago.id }, data: { estado: "RECHAZADO" } });
    return Response.json({ error: "No pudimos iniciar el pago, intentá de nuevo" }, { status: 502 });
  }
}