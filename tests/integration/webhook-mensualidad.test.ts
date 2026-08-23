import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { prisma } from "../../lib/db";

const SECRET = "test-secret-webhook-mensualidad";

beforeEach(async () => {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  await prisma.pago.deleteMany();
  await prisma.suscripcion.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
  vi.restoreAllMocks();
});

function firmar(dataId: string, requestId: string, ts: string): string {
  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", SECRET).update(template).digest("hex");
}

describe("POST /api/webhooks/mercadopago — subscription_authorized_payment", () => {
  it("crea el Pago de mensualidad a partir del authorized_payment, no del data.id directo", async () => {
    const user = await prisma.user.create({
      data: { email: "webhook-mensual@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Webhook Mensual", iniciales: "WM", objetivo: "" } });
    await prisma.suscripcion.create({
      data: { clienteId: cliente.id, estado: "ACTIVA", precio: 15000000, fechaProximoCobro: new Date(), mpPreapprovalId: "preapproval-abc" },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ preapproval_id: "preapproval-abc", payment: { id: 999888777, status: "approved" } }),
    } as Response);

    const ts = "1700000000";
    const dataId = "authorized-payment-1";
    const v1 = firmar(dataId, "req-1", ts);
    const { POST } = await import("../../app/api/webhooks/mercadopago/route");
    const res = await POST(
      new Request(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}&type=subscription_authorized_payment`, {
        method: "POST",
        headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-1" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(200);

    const pago = await prisma.pago.findFirstOrThrow({ where: { clienteId: cliente.id } });
    expect(pago.mpPaymentId).toBe("999888777");
    expect(pago.estado).toBe("APROBADO");
  });
});