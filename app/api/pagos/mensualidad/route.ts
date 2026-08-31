import { PreApproval } from "mercadopago";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/db";
import { mpClient } from "../../../../lib/mercadopago/client";
import { centavosAPesos } from "../../../../lib/dinero";
import { logger } from "../../../../lib/logger";

// Mismo default que usa el webhook (manejarPreapprovalAutorizado) si Mercado Pago no
// reporta transaction_amount: nunca frenar el cobro por una fila de configuración ausente.
const PRECIO_MENSUALIDAD_CENTAVOS_DEFAULT = 15000000;

export async function POST(_req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "No autenticado" }, { status: 401 });
  }

  const cliente = await prisma.cliente.findUnique({ where: { userId: session.user.id }, include: { user: true } });
  if (!cliente) {
    return Response.json({ error: "Cuenta sin perfil de cliente" }, { status: 400 });
  }

  const planMensual = await prisma.planPrecio.findUnique({ where: { slug: "mensual" } });
  if (!planMensual) {
    logger.warn("plan de precio 'mensual' no encontrado; se usa el precio default. Corré el seed para que sea editable desde el panel.");
  }
  const precioMensualidad = planMensual?.precio ?? PRECIO_MENSUALIDAD_CENTAVOS_DEFAULT;

  const existente = await prisma.suscripcion.findUnique({ where: { clienteId: cliente.id } });
  if (existente && existente.estado === "ACTIVA") {
    return Response.json({ error: "Ya tenés una mensualidad activa" }, { status: 409 });
  }

  try {
    // CRÍTICO (hallazgo 1.1 de la auditoría): NO se crea ninguna fila Suscripcion acá.
    // El Preapproval se crea y se devuelve el initPoint para que el cliente autorice
    // en la página de Mercado Pago; recién cuando el webhook `subscription_preapproval`
    // confirma `status: authorized` (consultando la API, sin confiar en el body) se
    // materializa la Suscripcion en ACTIVA. Si no llega esa notificación, no hay fila.
    const preapproval = new PreApproval(mpClient);
    const resultado = await preapproval.create({
      body: {
        reason: "Mensualidad RegTrainer",
        external_reference: cliente.id,
        payer_email: cliente.user.email,
        back_url: `${process.env.NEXTAUTH_URL}/?screen=cuenta`,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: centavosAPesos(precioMensualidad),
          currency_id: "ARS",
        },
      },
    });

    return Response.json({ initPoint: resultado.init_point }, { status: 201 });
  } catch (e) {
    logger.error({ err: e }, "error creando preapproval de mercado pago");
    return Response.json({ error: "No pudimos iniciar la suscripción, intentá de nuevo" }, { status: 502 });
  }
}