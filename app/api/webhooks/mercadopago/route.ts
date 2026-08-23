import { Payment, PreApproval } from "mercadopago";
import { prisma } from "../../../../lib/db";
import { mpClient } from "../../../../lib/mercadopago/client";
import { pesosACentavos } from "../../../../lib/dinero";
import { verificarFirmaWebhook } from "../../../../lib/mercadopago/firma";
import { crearReservaConCupo } from "../../../../lib/reservas/crear";
import { generarComprobantePago } from "../../../../lib/comprobantes/generar";
import { sendComprobanteEmail, sendCobroFallidoEmail } from "../../../../lib/email/templates";
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
  if (topic === "subscription_preapproval") {
    return manejarPreapprovalAutorizado(dataId);
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

      const clienteConUser = await prisma.cliente.findUnique({ where: { id: pago.clienteId }, include: { user: true } });
      if (clienteConUser) {
        void generarComprobantePago(pago.id)
          .then((pdf) => sendComprobanteEmail(clienteConUser.user.email, pdf, `comprobante-${pago.id}.pdf`))
          .catch((e) => logger.error({ err: e, pagoId: pago.id }, "no se pudo generar/enviar el comprobante"));
      }
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
    // La Suscripcion venció: el cobro recurrente fallo (rejected/pending/etc). Marcamos VENCIDA
    // y avisamos. Asi cubreMensualidad deja de dar cobertura (bug 1.2 de la auditoria).
    await marcarSuscripcionVencida(authorizedPayment.preapproval_id);
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

async function marcarSuscripcionVencida(preapprovalId: string | undefined): Promise<void> {
  if (!preapprovalId) return;
  const suscripcion = await prisma.suscripcion.findFirst({ where: { mpPreapprovalId: preapprovalId } });
  if (!suscripcion || suscripcion.estado !== "ACTIVA") return;

  await prisma.suscripcion.update({ where: { id: suscripcion.id }, data: { estado: "VENCIDA" } });

  const cliente = await prisma.cliente.findUnique({ where: { id: suscripcion.clienteId }, include: { user: true } });
  if (cliente?.user) {
    try {
      await sendCobroFallidoEmail(
        cliente.user.email,
        "No pudimos procesar tu cobro mensual. Tu acceso con cobertura de mensualidad queda pausado hasta que regularices el pago."
      );
    } catch (e) {
      logger.error({ err: e, suscripcionId: suscripcion.id }, "no se pudo notificar el cobro fallido");
    }
  }
}

async function manejarPreapprovalAutorizado(dataId: string): Promise<Response> {
  // Hallazgo 1.1: nunca confiamos en el body de la notificación; consultamos el
  // PreApproval contra la API real de Mercado Pago y leemos status + external_reference.
  let preapproval;
  try {
    const pre = new PreApproval(mpClient);
    preapproval = await pre.get({ id: dataId });
  } catch (e) {
    logger.error({ err: e, dataId }, "no se pudo consultar el preapproval de mercado pago");
    return Response.json({ ok: true });
  }

  const clienteId = preapproval.external_reference;
  if (!clienteId) {
    logger.warn({ dataId }, "preapproval sin external_reference reconocible");
    return Response.json({ ok: true });
  }

  if (preapproval.status === "authorized") {
    // El transaction_amount del preapproval viene en pesos; el precio interno en centavos.
    const precio = pesosACentavos(preapproval.auto_recurring?.transaction_amount ?? 0);
    try {
      await prisma.suscripcion.upsert({
        where: { clienteId },
        update: {
          estado: "ACTIVA",
          precio,
          fechaInicio: new Date(),
          fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          mpPreapprovalId: dataId,
          canceladaEn: null,
        },
        create: {
          clienteId,
          estado: "ACTIVA",
          precio,
          fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          mpPreapprovalId: dataId,
        },
      });
    } catch (e) {
      // El external_reference puede apuntar a un cliente que no existe en esta DB.
      logger.error({ err: e, dataId, clienteId }, "no se pudo materializar la suscripcion del preapproval");
    }
  } else {
    const existente = await prisma.suscripcion.findFirst({ where: { mpPreapprovalId: dataId } });
    if (existente) {
      await prisma.suscripcion.update({
        where: { id: existente.id },
        data: { estado: "CANCELADA", canceladaEn: new Date() },
      });
    }
  }
  return Response.json({ ok: true });
}