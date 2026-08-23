import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parsearXSignature, verificarFirmaWebhook } from "../../lib/mercadopago/firma";

const SECRET = "test-secret";

function firmarComo(dataId: string, requestId: string, ts: string, secret = SECRET): string {
  const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return createHmac("sha256", secret).update(template).digest("hex");
}

describe("parsearXSignature", () => {
  it("parsea ts y v1 del header", () => {
    const parsed = parsearXSignature("ts=123,v1=abc");
    expect(parsed).toEqual({ ts: "123", v1: "abc" });
  });
});

describe("verificarFirmaWebhook", () => {
  it("acepta una firma válida", () => {
    const ts = "1700000000";
    const v1 = firmarComo("999", "req-1", ts);
    const ok = verificarFirmaWebhook({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: "999",
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it("rechaza una firma con el secreto incorrecto", () => {
    const ts = "1700000000";
    const v1 = firmarComo("999", "req-1", ts, "otro-secreto");
    const ok = verificarFirmaWebhook({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: "999",
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });

  it("rechaza si falta el header x-signature", () => {
    const ok = verificarFirmaWebhook({ xSignature: null, xRequestId: "req-1", dataId: "999", secret: SECRET });
    expect(ok).toBe(false);
  });

  it("rechaza si el dataId no coincide con el firmado", () => {
    const ts = "1700000000";
    const v1 = firmarComo("999", "req-1", ts);
    const ok = verificarFirmaWebhook({
      xSignature: `ts=${ts},v1=${v1}`,
      xRequestId: "req-1",
      dataId: "otro-id",
      secret: SECRET,
    });
    expect(ok).toBe(false);
  });
});