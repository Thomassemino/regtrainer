import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { prisma } from "../../lib/db";

const SECRET = "test-secret-webhook";

vi.mock("mercadopago", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  class Payment {
    constructor(_config?: unknown) {}
    async get({ id }: { id: string }) {
      return { id, status: "approved", external_reference: (globalThis as unknown as { __externalRef?: string }).__externalRef };
    }
  }
  return { ...actual, Payment };
});

function firmar(dataId: string, requestId: string, ts: string): string {
  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", SECRET).update(template).digest("hex");
}

beforeEach(async () => {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  await prisma.reserva.deleteMany();
  await prisma.pago.deleteMany();
  await prisma.clase.deleteMany();
  await prisma.servicio.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
});

describe("POST /api/webhooks/mercadopago", () => {
  it("rechaza con firma inválida", async () => {
    const { POST } = await import("../../app/api/webhooks/mercadopago/route");
    const res = await POST(
      new Request("http://localhost/api/webhooks/mercadopago?data.id=123", {
        method: "POST",
        headers: { "x-signature": "ts=1,v1=firmaInvalida", "x-request-id": "req-1" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(401);
  });

  it("aprueba el pago y crea la reserva una sola vez aunque la notificación se repita", async () => {
    const user = await prisma.user.create({
      data: { email: "webhook@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({ data: { userId: user.id, nombre: "Webhook Test", iniciales: "WT", objetivo: "" } });
    const servicio = await prisma.servicio.create({
      data: { slug: "funcional", nombre: "Funcional", tag: "Grupal", duracionMin: 50, precio: 1200000, cupoMax: 8 },
    });
    const clase = await prisma.clase.create({
      data: { servicioId: servicio.id, fecha: new Date(Date.now() + 24 * 60 * 60 * 1000), cupoMax: 8 },
    });
    const pago = await prisma.pago.create({
      data: { clienteId: cliente.id, tipo: "CLASE_SUELTA", medio: "MERCADO_PAGO", monto: servicio.precio, estado: "PENDIENTE" },
    });
    (globalThis as unknown as { __externalRef?: string }).__externalRef = JSON.stringify({ pagoId: pago.id, claseId: clase.id });

    const ts = "1700000000";
    const dataId = "mp-payment-1";
    const v1 = firmar(dataId, "req-1", ts);
    const hacerRequest = () =>
      import("../../app/api/webhooks/mercadopago/route").then(({ POST }) =>
        POST(
          new Request(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}`, {
            method: "POST",
            headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-1" },
            body: JSON.stringify({ data: { id: dataId } }),
          })
        )
      );

    const primeraRespuesta = await hacerRequest();
    expect(primeraRespuesta.status).toBe(200);
    const segundaRespuesta = await hacerRequest();
    expect(segundaRespuesta.status).toBe(200);

    const pagoActualizado = await prisma.pago.findUniqueOrThrow({ where: { id: pago.id } });
    expect(pagoActualizado.estado).toBe("APROBADO");
    expect(pagoActualizado.mpPaymentId).toBe(dataId);

    const reservas = await prisma.reserva.findMany({ where: { claseId: clase.id } });
    expect(reservas).toHaveLength(1);
  });
});