import type { Prisma, PrismaClient, Servicio } from "@prisma/client";

type TxOrClient = Prisma.TransactionClient | PrismaClient;

export function semanaCalendarioActual(referencia: Date = new Date()): { inicio: Date; fin: Date } {
  const dia = referencia.getUTCDay();
  const offsetHastaLunes = dia === 0 ? 6 : dia - 1;
  const inicio = new Date(referencia);
  inicio.setUTCDate(referencia.getUTCDate() - offsetHastaLunes);
  inicio.setUTCHours(0, 0, 0, 0);
  const fin = new Date(inicio);
  fin.setUTCDate(inicio.getUTCDate() + 7);
  return { inicio, fin };
}

export async function cubreMensualidad(
  tx: TxOrClient,
  clienteId: string,
  servicio: Servicio,
  fechaClase?: Date
): Promise<{ cubierta: boolean }> {
  if (servicio.precio === 0) {
    return { cubierta: false };
  }

  const suscripcion = await tx.suscripcion.findUnique({ where: { clienteId } });
  if (!suscripcion) {
    return { cubierta: false };
  }
  // spec §7.2.5: una suscripcion CANCELADA sigue dando acceso hasta fechaProximoCobro
  // (ya esta pago ese periodo) — VENCIDA (cobro fallido) corta la cobertura de inmediato.
  const fechaReferencia = fechaClase ?? new Date();
  const tieneCobertura =
    suscripcion.estado === "ACTIVA" ||
    (suscripcion.estado === "CANCELADA" && suscripcion.fechaProximoCobro > fechaReferencia);
  if (!tieneCobertura) {
    return { cubierta: false };
  }

  if (servicio.slug !== "personal") {
    return { cubierta: true };
  }

  const { inicio, fin } = semanaCalendarioActual(fechaClase);
  // Solo reservas que efectivamente otorgan lugar consumen el beneficio semanal:
  // una LISTA_ESPERA no confirma cupo ni debe comerse el slot.
  const usadasEstaSemana = await tx.reserva.count({
    where: {
      clienteId,
      viaMensualidad: true,
      estado: { in: ["CONFIRMADA", "ASISTIO", "NO_ASISTIO"] },
      clase: { servicioId: servicio.id, fecha: { gte: inicio, lt: fin } },
    },
  });

  return { cubierta: usadasEstaSemana < 1 };
}