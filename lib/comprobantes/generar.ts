import { createHmac, timingSafeEqual } from "node:crypto";
import { renderPdf } from "../pdf/render";

function secreto(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET no configurado");
  return s;
}

export function generarTokenComprobante(pagoId: string): string {
  return createHmac("sha256", secreto()).update(pagoId).digest("hex");
}

export function verificarTokenComprobante(pagoId: string, token: string): boolean {
  const esperado = Buffer.from(generarTokenComprobante(pagoId), "hex");
  const recibido = Buffer.from(token, "hex");
  if (esperado.length !== recibido.length) return false;
  return timingSafeEqual(esperado, recibido);
}

export async function generarComprobantePago(pagoId: string): Promise<Buffer> {
  const token = generarTokenComprobante(pagoId);
  const url = `${process.env.NEXTAUTH_URL}/comprobante/${pagoId}?token=${token}`;
  return renderPdf(url);
}