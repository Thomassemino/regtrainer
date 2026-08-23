import { prisma } from "../../../../lib/db";
import { requireAdmin } from "../../../../lib/coach/guards";
import { centavosAPesos } from "../../../../lib/dinero";

// Bug 1.5: no existia un GET para listar pagos reales; pagosCoach era mock y el boton
// "Marcar recibido" (condicionado a pendienteEfectivo) nunca se rendia.
export async function GET(_req: Request) {
  const autorizado = await requireAdmin();
  if (autorizado.error) return autorizado.error;

  const pagos = await prisma.pago.findMany({
    include: { cliente: true },
    orderBy: { creadoEn: "desc" },
  });

  return Response.json({
    pagos: pagos.map((p) => ({
      pagoId: p.id,
      cliente: p.cliente.nombre,
      concepto: p.tipo === "MENSUALIDAD" ? "Mensualidad" : "Clase suelta",
      medio: p.medio,
      estado: p.estado,
      montoCentavos: p.monto,
      montoPesos: centavosAPesos(p.monto),
      fecha: p.creadoEn.toISOString(),
      pendienteEfectivo: p.medio === "EFECTIVO" && p.estado === "PENDIENTE",
    })),
  });
}