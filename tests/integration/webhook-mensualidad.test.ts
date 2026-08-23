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

  it("marca la Suscripcion como VENCIDA si el cobro recurrente no fue approved (bug 1.2)", async () => {
    const user = await prisma.user.create({
      data: { email: "webhook-vencida@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Webhook Vencida", iniciales: "WV", objetivo: "" } });
    await prisma.suscripcion.create({
      data: { clienteId: cliente.id, estado: "ACTIVA", precio: 15000000, fechaProximoCobro: new Date(), mpPreapprovalId: "preapproval-vencida" },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ preapproval_id: "preapproval-vencida", payment: { id: 123456, status: "rejected" } }),
    } as Response);

    const ts = "1700000000";
    const dataId = "authorized-payment-2";
    const v1 = firmar(dataId, "req-2", ts);
    const { POST } = await import("../../app/api/webhooks/mercadopago/route");
    const res = await POST(
      new Request(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}&type=subscription_authorized_payment`, {
        method: "POST",
        headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-2" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(200);

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    expect(suscripcion.estado).toBe("VENCIDA");
  });

  it("un cobro transitorio (pending/in_process) NO marca la Suscripcion como VENCIDA", async () => {
    const user = await prisma.user.create({
      data: { email: "webhook-pending@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Webhook Pending", iniciales: "WP", objetivo: "" } });
    await prisma.suscripcion.create({
      data: { clienteId: cliente.id, estado: "ACTIVA", precio: 15000000, fechaProximoCobro: new Date(), mpPreapprovalId: "preapproval-pending" },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ preapproval_id: "preapproval-pending", payment: { id: 123457, status: "in_process" } }),
    } as Response);

    const ts = "1700000000";
    const dataId = "authorized-payment-3";
    const v1 = firmar(dataId, "req-3", ts);
    const { POST } = await import("../../app/api/webhooks/mercadopago/route");
    const res = await POST(
      new Request(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}&type=subscription_authorized_payment`, {
        method: "POST",
        headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-3" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(200);

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    expect(suscripcion.estado).toBe("ACTIVA");
  });

  it("una Suscripcion VENCIDA se reactiva a ACTIVA cuando llega un cobro aprobado posterior", async () => {
    const user = await prisma.user.create({
      data: { email: "webhook-reactivar@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Webhook Reactivar", iniciales: "WR", objetivo: "" } });
    await prisma.suscripcion.create({
      data: { clienteId: cliente.id, estado: "VENCIDA", precio: 15000000, fechaProximoCobro: new Date(), mpPreapprovalId: "preapproval-reactivar" },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ preapproval_id: "preapproval-reactivar", payment: { id: 123458, status: "approved" } }),
    } as Response);

    const ts = "1700000000";
    const dataId = "authorized-payment-4";
    const v1 = firmar(dataId, "req-4", ts);
    const { POST } = await import("../../app/api/webhooks/mercadopago/route");
    const res = await POST(
      new Request(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}&type=subscription_authorized_payment`, {
        method: "POST",
        headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-4" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(200);

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    expect(suscripcion.estado).toBe("ACTIVA");
    expect(suscripcion.canceladaEn).toBeNull();
    const pago = await prisma.pago.findFirstOrThrow({ where: { suscripcionId: suscripcion.id } });
    expect(pago.mpPaymentId).toBe("123458");
    expect(pago.estado).toBe("APROBADO");
  });

  it("un cobro aprobado NO reactiva una Suscripcion CANCELADA explícitamente por el cliente", async () => {
    const user = await prisma.user.create({
      data: { email: "webhook-no-cancel@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Webhook No Cancel", iniciales: "WNC", objetivo: "" } });
    await prisma.suscripcion.create({
      data: {
        clienteId: cliente.id,
        estado: "CANCELADA",
        precio: 15000000,
        fechaProximoCobro: new Date(),
        mpPreapprovalId: "preapproval-cancelled-user",
        canceladaEn: new Date(),
      },
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ preapproval_id: "preapproval-cancelled-user", payment: { id: 123459, status: "approved" } }),
    } as Response);

    const ts = "1700000000";
    const dataId = "authorized-payment-5";
    const v1 = firmar(dataId, "req-5", ts);
    const { POST } = await import("../../app/api/webhooks/mercadopago/route");
    const res = await POST(
      new Request(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}&type=subscription_authorized_payment`, {
        method: "POST",
        headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-5" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(200);

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    expect(suscripcion.estado).toBe("CANCELADA");
    expect(suscripcion.canceladaEn).not.toBeNull();
    const pago = await prisma.pago.findFirstOrThrow({ where: { suscripcionId: suscripcion.id } });
    expect(pago.mpPaymentId).toBe("123459");
    expect(pago.estado).toBe("APROBADO");
  });
});