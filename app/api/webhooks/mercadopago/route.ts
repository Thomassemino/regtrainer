import { Payment } from "mercadopago";
import { prisma } from "../../../../lib/db";
import { mpClient } from "../../../../lib/mercadopago/client";
import { verificarFirmaWebhook } from "../../../../lib/mercadopago/firma";
import { crearReservaConCupo } from "../../../../lib/reservas/crear";
import { logger } from "../../../../lib/logger";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const dataId = url.searchParams.get("data.id") ?? url.searchParams.get("id");
  if (!dataId) {
    return Response.json({ ok: true });
  }

  const firmaValida = verificarFirmaWebhook({
    xSignature: req.headers.get("x-signature"),
    xRequestId: req.headers.get("x-request-id"),
    dataId,
    secret: process.env.MERCADOPAGO_WEBHOOK_SECRET ?? "",
  });
  if (!firmaValida) {
    logger.warn({ dataId }, "webhook de mercado pago con firma inválida");
    return Response.json({ error: "Firma inválida" }, { status: 401 });
  }

  const topic = url.searchParams.get("type") ?? url.searchParams.get("topic");
  if (topic === "subscription_authorized_payment") {
    return manejarSubscriptionAutorizado(dataId);
  }

  const payment = new Payment(mpClient);
  const pagoMp = await payment.get({ id: dataId });

  const externalRef = pagoMp.external_reference ? JSON.parse(pagoMp.external_reference) : null;
  if (!externalRef?.pagoId) {
    logger.warn({ dataId }, "webhook de mercado pago sin external_reference reconocible");
    return Response.json({ ok: true });
  }

  const pago = await prisma.pago.findUnique({ where: { id: externalRef.pagoId } });
  if (!pago) {
    logger.warn({ pagoId: externalRef.pagoId }, "webhook referencia un pago inexistente");
    return Response.json({ ok: true });
  }
  if (pago.estado !== "PENDIENTE") {
    return Response.json({ ok: true });
  }

  if (pagoMp.status === "approved") {
    await prisma.pago.update({
      where: { id: pago.id },
      data: { estado: "APROBADO", mpPaymentId: String(pagoMp.id) },
    });

    try {
      await crearReservaConCupo({
        clienteId: pago.clienteId,
        claseId: externalRef.claseId,
        medio: null,
        pagoIdExistente: pago.id,
      });
    } catch (e) {
      logger.error({ err: e, pagoId: pago.id }, "pago aprobado pero no se pudo crear la reserva");
    }
  } else if (pagoMp.status === "rejected") {
    await prisma.pago.update({ where: { id: pago.id }, data: { estado: "RECHAZADO", mpPaymentId: String(pagoMp.id) } });
  }

  return Response.json({ ok: true });
}

async function manejarSubscriptionAutorizado(dataId: string): Promise<Response> {
  const authorizedPaymentRes = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, {
    headers: { Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}` },
  });
  if (!authorizedPaymentRes.ok) {
    logger.error({ dataId, status: authorizedPaymentRes.status }, "no se pudo consultar el authorized_payment de mercado pago");
    return Response.json({ ok: true });
  }
  const authorizedPayment: { preapproval_id: string; payment?: { id: number | string; status: string } } =
    await authorizedPaymentRes.json();

  if (!authorizedPayment.payment || authorizedPayment.payment.status !== "approved") {
    return Response.json({ ok: true });
  }

  const suscripcion = await prisma.suscripcion.findFirst({ where: { mpPreapprovalId: authorizedPayment.preapproval_id } });
  if (suscripcion) {
    const mpPaymentId = String(authorizedPayment.payment.id);
    const yaRegistrado = await prisma.pago.findFirst({ where: { suscripcionId: suscripcion.id, mpPaymentId } });
    if (!yaRegistrado) {
      await prisma.pago.create({
        data: {
          clienteId: suscripcion.clienteId,
          tipo: "MENSUALIDAD",
          medio: "MERCADO_PAGO",
          monto: suscripcion.precio,
          estado: "APROBADO",
          mpPaymentId,
          suscripcionId: suscripcion.id,
        },
      });
      await prisma.suscripcion.update({
        where: { id: suscripcion.id },
        data: { fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      });
    }
  }
  return Response.json({ ok: true });
}