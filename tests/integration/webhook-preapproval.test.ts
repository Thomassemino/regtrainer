import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { prisma } from "../../lib/db";

const SECRET = "test-secret-preapproval";

vi.mock("mercadopago", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  class PreApproval {
    constructor(_config?: unknown) {}
    async create() {
      return { id: "preapproval-abc", init_point: "https://mercadopago.com/init/abc" };
    }
    async get({ id }: { id: string }) {
      const g = globalThis as unknown as {
        __preapprovalStatus?: string;
        __preapprovalExternalRef?: string;
        __preapprovalMonto?: number;
      };
      return {
        id,
        status: g.__preapprovalStatus ?? "authorized",
        external_reference: g.__preapprovalExternalRef ?? "",
        auto_recurring: { transaction_amount: g.__preapprovalMonto ?? 150000 },
      };
    }
  }
  return { ...actual, PreApproval };
});

vi.mock("../../lib/auth", () => ({ auth: vi.fn() }));

function firmar(dataId: string, requestId: string, ts: string): string {
  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", SECRET).update(template).digest("hex");
}

beforeEach(async () => {
  process.env.MERCADOPAGO_WEBHOOK_SECRET = SECRET;
  await prisma.pago.deleteMany();
  await prisma.suscripcion.deleteMany();
  await prisma.cliente.deleteMany();
  await prisma.user.deleteMany();
  vi.restoreAllMocks();
});

async function dispararWebhookPreapproval(dataId: string) {
  const ts = "1700000000";
  const v1 = firmar(dataId, "req-pre", ts);
  const { POST } = await import("../../app/api/webhooks/mercadopago/route");
  return POST(
    new Request(`http://localhost/api/webhooks/mercadopago?data.id=${dataId}&type=subscription_preapproval`, {
      method: "POST",
      headers: { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": "req-pre" },
      body: JSON.stringify({}),
    })
  );
}

describe("POST /api/pagos/mensualidad + POST /api/webhooks (subscription_preapproval)", () => {
  it("reproduce el bug 1.1: POST no crea Suscripcion; solo el webhook authorized la materializa en ACTIVA", async () => {
    const user = await prisma.user.create({
      data: { email: "preapproval-flow@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({
      data: { userId: user.id, nombre: "Preapproval Flow", iniciales: "PF", objetivo: "" },
    });

    const { auth } = await import("../../lib/auth");
    vi.mocked(auth).mockResolvedValue({ user: { id: user.id } } as never);

    // 1) El cliente llama al endpoint de mensualidad: NO debe quedar ninguna fila.
    const { POST } = await import("../../app/api/pagos/mensualidad/route");
    const res = await POST(new Request("http://localhost/api/pagos/mensualidad", { method: "POST" }));
    expect(res.status).toBe(201);
    expect(await prisma.suscripcion.findUnique({ where: { clienteId: cliente.id } })).toBeNull();

    // 2) Mercado Pago notifica el preapproval autorizado (consultamos la API, no el body).
    (globalThis as unknown as { __preapprovalStatus?: string }).__preapprovalStatus = "authorized";
    (globalThis as unknown as { __preapprovalExternalRef?: string }).__preapprovalExternalRef = cliente.id;
    const webhookRes = await dispararWebhookPreapproval("preapproval-abc");
    expect(webhookRes.status).toBe(200);

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    expect(suscripcion.estado).toBe("ACTIVA");
    expect(suscripcion.mpPreapprovalId).toBe("preapproval-abc");
    expect(suscripcion.precio).toBe(15000000);
  });

  it("si el preapproval NO quedó authorized, marca CANCELADA una Suscripcion existente con ese mpPreapprovalId", async () => {
    const user = await prisma.user.create({
      data: { email: "preapproval-cancel@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({
      data: { userId: user.id, nombre: "Preapro Cancel", iniciales: "PC", objetivo: "" },
    });
    await prisma.suscripcion.create({
      data: {
        clienteId: cliente.id,
        estado: "ACTIVA",
        precio: 15000000,
        fechaProximoCobro: new Date(),
        mpPreapprovalId: "preapproval-cancelled-1",
      },
    });

    (globalThis as unknown as { __preapprovalStatus?: string }).__preapprovalStatus = "cancelled";
    (globalThis as unknown as { __preapprovalExternalRef?: string }).__preapprovalExternalRef = cliente.id;
    const webhookRes = await dispararWebhookPreapproval("preapproval-cancelled-1");
    expect(webhookRes.status).toBe(200);

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    expect(suscripcion.estado).toBe("CANCELADA");
    expect(suscripcion.canceladaEn).not.toBeNull();
  });

  it("si el preapproval autorizado no reporta transaction_amount, usa el precio default (no 0)", async () => {
    const user = await prisma.user.create({
      data: { email: "preapproval-sin-monto@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({
      data: { userId: user.id, nombre: "Preapro Sin Monto", iniciales: "PSM", objetivo: "" },
    });

    (globalThis as unknown as { __preapprovalStatus?: string }).__preapprovalStatus = "authorized";
    (globalThis as unknown as { __preapprovalExternalRef?: string }).__preapprovalExternalRef = cliente.id;
    (globalThis as unknown as { __preapprovalMonto?: number | null }).__preapprovalMonto = 0;
    const webhookRes = await dispararWebhookPreapproval("preapproval-sin-monto");
    expect(webhookRes.status).toBe(200);

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    expect(suscripcion.estado).toBe("ACTIVA");
    // NUNCA precio 0: cae al default de mensualidad.
    expect(suscripcion.precio).toBeGreaterThan(0);
  });

  it("un preapproval autorizado que apunta a un cliente inexistente no crashea (se traga el FK)", async () => {
    (globalThis as unknown as { __preapprovalStatus?: string }).__preapprovalStatus = "authorized";
    (globalThis as unknown as { __preapprovalExternalRef?: string }).__preapprovalExternalRef = "cliente-que-no-existe";
    (globalThis as unknown as { __preapprovalMonto?: number }).__preapprovalMonto = 150000;
    const webhookRes = await dispararWebhookPreapproval("preapproval-fk");
    expect(webhookRes.status).toBe(200);
  });

  it("un authorized tardio del MISMO preapproval que el cliente canceló NO revive la cancelacion", async () => {
    const user = await prisma.user.create({
      data: { email: "preapproval-no-revive@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({
      data: { userId: user.id, nombre: "Preapro No Revive", iniciales: "PNR", objetivo: "" },
    });
    const canceladaEn = new Date();
    await prisma.suscripcion.create({
      data: {
        clienteId: cliente.id,
        estado: "CANCELADA",
        precio: 15000000,
        fechaProximoCobro: new Date(),
        mpPreapprovalId: "preapproval-cancelado-mismo",
        canceladaEn,
      },
    });

    (globalThis as unknown as { __preapprovalStatus?: string }).__preapprovalStatus = "authorized";
    (globalThis as unknown as { __preapprovalExternalRef?: string }).__preapprovalExternalRef = cliente.id;
    (globalThis as unknown as { __preapprovalMonto?: number }).__preapprovalMonto = 150000;
    const webhookRes = await dispararWebhookPreapproval("preapproval-cancelado-mismo");
    expect(webhookRes.status).toBe(200);

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    // Sigue CANCELADA y con su canceladaEn intacta (no se des-canceló el acceso).
    expect(suscripcion.estado).toBe("CANCELADA");
    expect(suscripcion.canceladaEn?.toISOString()).toBe(canceladaEn.toISOString());
  });

  it("un authorized de un preapproval NUEVO (id distinto) tras una cancelacion es una re-suscripcion y activa", async () => {
    const user = await prisma.user.create({
      data: { email: "preapproval-resus@example.com", passwordHash: "x", role: "CLIENTE", emailVerified: new Date() },
    });
    const cliente = await prisma.cliente.create({
      data: { userId: user.id, nombre: "Preapro Resus", iniciales: "PR", objetivo: "" },
    });
    await prisma.suscripcion.create({
      data: {
        clienteId: cliente.id,
        estado: "CANCELADA",
        precio: 15000000,
        fechaProximoCobro: new Date(),
        mpPreapprovalId: "preapproval-viejo",
        canceladaEn: new Date(),
      },
    });

    (globalThis as unknown as { __preapprovalStatus?: string }).__preapprovalStatus = "authorized";
    (globalThis as unknown as { __preapprovalExternalRef?: string }).__preapprovalExternalRef = cliente.id;
    (globalThis as unknown as { __preapprovalMonto?: number }).__preapprovalMonto = 150000;
    const webhookRes = await dispararWebhookPreapproval("preapproval-nuevo");
    expect(webhookRes.status).toBe(200);

    const suscripcion = await prisma.suscripcion.findUniqueOrThrow({ where: { clienteId: cliente.id } });
    expect(suscripcion.estado).toBe("ACTIVA");
    expect(suscripcion.mpPreapprovalId).toBe("preapproval-nuevo");
    expect(suscripcion.canceladaEn).toBeNull();
  });
});