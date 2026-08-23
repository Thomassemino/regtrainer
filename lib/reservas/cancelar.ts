import { Prisma } from "@prisma/client";
import { prisma } from "../db";

const DOCE_HORAS_MS = 12 * 60 * 60 * 1000;

export function puedeCancelarSinCargo(fechaClase: Date, ahora: Date = new Date()): boolean {
  return fechaClase.getTime() - ahora.getTime() >= DOCE_HORAS_MS;
}

export class NoAutorizadoError extends Error {
  constructor() {
    super("No autorizado a cancelar esta reserva");
    this.name = "NoAutorizadoError";
  }
}

async function conReintentoDeSerializacion<T>(fn: () => Promise<T>, intentos = 10): Promise<T> {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      return await fn();
    } catch (e) {
      const esConflictoDeSerializacion =
        (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") ||
        (typeof e === "object" && e !== null &&
          (e as { name?: unknown }).name === "DriverAdapterError" &&
          ((e as { cause?: { kind?: unknown } }).cause?.kind === "TransactionWriteConflict"));
      if (!esConflictoDeSerializacion || intento === intentos) throw e;
    }
  }
  throw new Error("No se pudo completar la operación tras reintentos");
}

export async function cancelarReserva(params: { reservaId: string; clienteId: string }): Promise<void> {
  await conReintentoDeSerializacion(() =>
    prisma.$transaction(
      async (tx) => {
        const reserva = await tx.reserva.findUniqueOrThrow({
          where: { id: params.reservaId },
          include: { clase: true, pago: true },
        });
        if (reserva.clienteId !== params.clienteId) {
          throw new NoAutorizadoError();
        }
        if (reserva.estado === "CANCELADA") {
          return;
        }

        const aTiempo = puedeCancelarSinCargo(reserva.clase.fecha);
        const eraConfirmada = reserva.estado === "CONFIRMADA";

        await tx.reserva.update({
          where: { id: reserva.id },
          data: { estado: "CANCELADA", canceladaEn: new Date(), canceladaTarde: !aTiempo },
        });

        if (reserva.pago && reserva.pago.estado === "APROBADO" && aTiempo) {
          await tx.pago.update({ where: { id: reserva.pago.id }, data: { estado: "REEMBOLSADO" } });
        }

        if (eraConfirmada) {
          const siguienteEnEspera = await tx.reserva.findFirst({
            where: { claseId: reserva.claseId, estado: "LISTA_ESPERA" },
            orderBy: { creadaEn: "asc" },
          });
          if (siguienteEnEspera) {
            await tx.reserva.update({ where: { id: siguienteEnEspera.id }, data: { estado: "CONFIRMADA" } });
          }
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}