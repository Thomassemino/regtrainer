import { WebhookSignatureValidator } from "mercadopago";

export function parsearXSignature(header: string): { ts?: string; v1?: string } {
  const resultado: { ts?: string; v1?: string } = {};
  for (const parte of header.split(",")) {
    const [clave, valor] = parte.split("=").map((s) => s.trim());
    if (clave === "ts" || clave === "v1") {
      resultado[clave] = valor;
    }
  }
  return resultado;
}

export function verificarFirmaWebhook(params: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret: string;
  toleranceSeconds?: number;
}): boolean {
  if (!params.xSignature || !params.xRequestId || !params.secret || !params.dataId) return false;
  try {
    WebhookSignatureValidator.validate({
      xSignature: params.xSignature,
      xRequestId: params.xRequestId,
      dataId: params.dataId,
      secret: params.secret,
      toleranceSeconds: params.toleranceSeconds,
    });
    return true;
  } catch {
    return false;
  }
}