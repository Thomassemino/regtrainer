import { notFound } from "next/navigation";
import { prisma } from "../../../lib/db";
import { centavosAPesos } from "../../../lib/dinero";
import { verificarTokenComprobante } from "../../../lib/comprobantes/generar";

export default async function ComprobantePage({
  params,
  searchParams,
}: {
  params: Promise<{ pagoId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { pagoId } = await params;
  const { token } = await searchParams;
  if (!token || !verificarTokenComprobante(pagoId, token)) {
    notFound();
  }

  const pago = await prisma.pago.findUnique({ where: { id: pagoId }, include: { cliente: true } });
  if (!pago) {
    notFound();
  }

  return (
    <div style={{ fontFamily: "Arial, sans-serif", padding: 40, color: "#1a1a1a" }}>
      <h1 style={{ fontSize: 22, marginBottom: 24 }}>RegTrainer — Comprobante interno</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <tbody>
          <tr><td style={{ padding: "6px 0", opacity: 0.6 }}>Cliente</td><td>{pago.cliente.nombre}</td></tr>
          <tr><td style={{ padding: "6px 0", opacity: 0.6 }}>Concepto</td><td>{pago.tipo === "MENSUALIDAD" ? "Mensualidad" : "Clase suelta"}</td></tr>
          <tr><td style={{ padding: "6px 0", opacity: 0.6 }}>Monto</td><td>${centavosAPesos(pago.monto).toLocaleString("es-AR")}</td></tr>
          <tr><td style={{ padding: "6px 0", opacity: 0.6 }}>Fecha</td><td>{pago.creadoEn.toLocaleDateString("es-AR")}</td></tr>
          <tr><td style={{ padding: "6px 0", opacity: 0.6 }}>Medio de pago</td><td>{pago.medio === "MERCADO_PAGO" ? "Mercado Pago" : "Efectivo"}</td></tr>
        </tbody>
      </table>
      <p style={{ marginTop: 48, fontSize: 11, fontStyle: "italic", opacity: 0.7 }}>
        Comprobante interno de RegTrainer. No es una factura válida ante AFIP.
      </p>
    </div>
  );
}