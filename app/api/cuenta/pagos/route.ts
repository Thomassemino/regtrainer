import { prisma } from "../../../../lib/db";
import { requireClienteActual } from "../../../../lib/coach/guards";
import { centavosAPesos } from "../../../../lib/dinero";

const TEXTO_MEDIO: Record<string, string> = { MERCADO_PAGO: "Mercado Pago", EFECTIVO: "Efectivo" };

export async function GET() {
  const check = await requireClienteActual();
  if (check.error) return check.error;

  const pagos = await prisma.pago.findMany({
    where: { clienteId: check.cliente.id, estado: "APROBADO" },
    orderBy: { creadoEn: "desc" },
    take: 20,
  });

  return Response.json({
    pagos: pagos.map((p) => ({
      fecha: p.creadoEn.toISOString(),
      concepto: p.tipo === "MENSUALIDAD" ? "Mensualidad" : "Clase personalizada",
      medio: TEXTO_MEDIO[p.medio] ?? p.medio,
      importe: "$" + centavosAPesos(p.monto).toLocaleString("es-AR"),
    })),
  });
}
