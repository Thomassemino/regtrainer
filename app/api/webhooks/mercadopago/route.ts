import { Payment, PreApproval } from "mercadopago";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../lib/db";
import { mpClient } from "../../../../lib/mercadopago/client";
import { pesosACentavos } from "../../../../lib/dinero";
import { verificarFirmaWebhook } from "../../../../lib/mercadopago/firma";
import { crearReservaConCupo } from "../../../../lib/reservas/crear";
import { generarComprobantePago } from "../../../../lib/comprobantes/generar";
import { sendComprobanteEmail, sendCobroFallidoEmail } from "../../../../lib/email/templates";
import { logger } from "../../../../lib/logger";

const PRECIO_MENSUALIDAD_CENTAVOS_DEFAULT = 15000000;

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
  if (!topic || topic === "payment") {
    // Checkout Pro / pagos sueltos llegan con topic=payment.
  } else {
    // Cualquier otro topic (merchant_order, etc.) nunca debe resolverse como Payment:
    // consultar payment.get con ese id rompería la firma del flujo. Respuesta OK y no
    // reintentable para no espantar notificaciones que no nos corresponden.
    return Response.json({ ok: true });
  }

  const payment = new Payment(mpClient);
  let pagoMp;
  try {
    pagoMp = await payment.get({ id: dataId });
  } catch (e) {
    logger.error({ err: e, dataId }, "no se pudo consultar el pago de mercado pago");
    return Response.json({ ok: true });
  }

  let externalRef = null;
  try {
    externalRef = pagoMp.external_reference ? JSON.parse(pagoMp.external_reference) : null;
  } catch {
    logger.warn({ dataId }, "external_reference no es JSON válido");
    return Response.json({ ok: true });
  }
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

  if (!authorizedPayment.payment) {
    return Response.json({ ok: true });
  }

  const statusPago = authorizedPayment.payment.status;
  const estadosTerminalDeFallo = ["rejected", "cancelled", "refunded", "charged_back"];
  if (estadosTerminalDeFallo.includes(statusPago)) {
    // Cobro recurrente falló de forma DEFINITIVA (no pending/in_process, que son
    // transitorios y pueden aprobarse en un reintento). Marcamos VENCIDA y avisamos.
    await marcarSuscripcionVencida(authorizedPayment.preapproval_id);
    return Response.json({ ok: true });
  }
  if (statusPago !== "approved") {
    // states transitorios (pending/in_process/authorized): no cambiamos estado, MP reintentará.
    return Response.json({ ok: true });
  }

  const suscripcion = await prisma.suscripcion.findFirst({ where: { mpPreapprovalId: authorizedPayment.preapproval_id } });
  if (suscripcion) {
    const reactivable = !suscripcion.canceladaEn && suscripcion.estado !== "CANCELADA";

    const mpPaymentId = String(authorizedPayment.payment.id);
    const yaRegistrado = await prisma.pago.findFirst({ where: { suscripcionId: suscripcion.id, mpPaymentId } });

    if (yaRegistrado) {
      // La notificación ya fue procesada: SOLO reaffirmar el estado (crash-recovery
      // idempotente: si el update anterior falló y el pago nuevo ya existe) sin
      // re-avanzar la fecha de cobro ni reactivar una VENCIDA sin cobro nuevo.
      if (reactivable && suscripcion.estado !== "ACTIVA") {
        await prisma.suscripcion.update({
          where: { id: suscripcion.id },
          data: { estado: "ACTIVA", canceladaEn: null },
        });
      }
      return Response.json({ ok: true });
    }

    try {
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
    } catch (e) {
      // Dos notificaciones idénticas en vuelo pueden pasar el findFirst y chocar
      // contra el @unique de mpPaymentId (P2002): el ganador ya creó el Pago,
      // tratamos el perdedor como éxito y NO avanzamos la fecha ni re-activamos.
      const esDuplicado = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!esDuplicado) throw e;
      return Response.json({ ok: true });
    }

    // Cobro nuevo procesado: avanzar fecha; re-activar solo si la suscripción
    // NO fue cancelada explícitamente por el cliente.
    await prisma.suscripcion.update({
      where: { id: suscripcion.id },
      data: reactivable
        ? { estado: "ACTIVA", canceladaEn: null, fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
        : { fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    });
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
    // Si MP no lo reporta, caemos al precio default en vez de materializar una suscripción
    // ACTIVA con precio 0 (que luego generaría Pago.monto = 0).
    const montoPesos = preapproval.auto_recurring?.transaction_amount;
    const precio =
      montoPesos && Number.isFinite(montoPesos) && montoPesos > 0
        ? pesosACentavos(montoPesos)
        : PRECIO_MENSUALIDAD_CENTAVOS_DEFAULT;
    if (!montoPesos) {
      logger.warn({ dataId, clienteId }, "preapproval sin transaction_amount; se usa precio default");
    }

    // No reactivar una suscripción que el cliente canceló EXPLÍCITAMENTE sobre este
    // mismo preapproval: una notificación authorized tardía no debe revivirla (misma
    // regla que el cobro recurrente en manejarSubscriptionAutorizado). Un preapproval
    // con OTRO id es una re-suscripción nueva y sí activa (upsert update normal).
    const existenteActual = await prisma.suscripcion.findUnique({ where: { clienteId } }).catch(() => null);
    const esElMismoPreapprovalCancelado =
      !!existenteActual &&
      existenteActual.mpPreapprovalId === dataId &&
      (existenteActual.canceladaEn !== null || existenteActual.estado === "CANCELADA");

    try {
      const dataUpsert = esElMismoPreapprovalCancelado
        ? {
            // Mantiene CANCELADA y su canceladaEn pero actualiza el resto de datos.
            estado: "CANCELADA",
            precio,
            fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            canceladaEn: existenteActual!.canceladaEn,
          }
        : {
            estado: "ACTIVA",
            precio,
            fechaInicio: new Date(),
            fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            mpPreapprovalId: dataId,
            canceladaEn: null,
          };
      await prisma.suscripcion.upsert({
        where: { clienteId },
        update: dataUpsert,
        create: {
          clienteId,
          estado: "ACTIVA",
          precio,
          fechaProximoCobro: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          mpPreapprovalId: dataId,
        },
      });
    } catch (e) {
      // Solo el FK de "cliente inexistente" (external_reference apunta a un id que
      // no está en esta DB) es descartable. Cualquier otro error (DB caída, conflicto,
      // race) debe propagarse para que Mercado Pago reintente la notificación.
      // Verificado contra el adapter instalado: el P2003 llega como
      // PrismaClientKnownRequestError; en el upsert de Suscripcion el único FK que
      // puede violarse es el de clienteId.
      const esFKClienteInexistente =
        e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003";
      if (esFKClienteInexistente) {
        logger.warn({ dataId, clienteId }, "preapproval autorizado para un cliente inexistente en esta DB");
      } else {
        throw e;
      }
    }
  } else if (preapproval.status === "cancelled") {
    // Solo la cancelación EXPLÍCITA del preapproval marca CANCELADA. Estados como
    // paused/pending son transitorios y no deben matar una suscripción viva.
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