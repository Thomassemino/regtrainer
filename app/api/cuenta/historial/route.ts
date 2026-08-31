import { prisma } from "../../../../lib/db";
import { requireClienteActual } from "../../../../lib/coach/guards";
import { centavosAPesos } from "../../../../lib/dinero";

const TEXTO_ESTADO: Record<string, string> = {
  ASISTIO: "Asististe",
  NO_ASISTIO: "No asististe",
  CANCELADA: "Cancelada",
  CONFIRMADA: "Confirmada",
  LISTA_ESPERA: "Lista de espera",
};

export async function GET() {
  const check = await requireClienteActual();
  if (check.error) return check.error;

  const reservas = await prisma.reserva.findMany({
    where: { clienteId: check.cliente.id, estado: { in: ["ASISTIO", "NO_ASISTIO", "CANCELADA"] } },
    include: { clase: { include: { servicio: true } }, pago: true },
    orderBy: { clase: { fecha: "desc" } },
    take: 30,
  });

  return Response.json({
    historial: reservas.map((r) => ({
      fecha: r.clase.fecha.toISOString(),
      clase: r.clase.servicio.nombre,
      estado: TEXTO_ESTADO[r.estado] ?? r.estado,
      pago: r.estado === "CANCELADA" && !r.canceladaTarde ? "Devuelto" : r.pago ? "$" + centavosAPesos(r.pago.monto).toLocaleString("es-AR") : "—",
    })),
  });
}
