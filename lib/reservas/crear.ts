import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { calcularEstadoReserva } from "./cupo";
import { cubreMensualidad } from "./mensualidad";

export type ResultadoReserva = {
  reservaId: string;
  estado: "CONFIRMADA" | "LISTA_ESPERA";
  viaMensualidad: boolean;
  monto: number;
};

export class RequierePagoError extends Error {
  constructor() {
    super("Este servicio requiere pago — usar POST /api/pagos/clase");
    this.name = "RequierePagoError";
  }
}

async function esperarBackoff(intento: number): Promise<void> {
  // Backoff corto con jitter (10–50ms por intento). Bajo contención real esto reduce
  // la carga en la DB comparado con el loop apretado, sin cambiar la corrección del retry.
  const base = 10 * intento;
  await new Promise((resolve) => setTimeout(resolve, base + Math.floor(Math.random() * 40 * intento)));
}

async function conReintentoDeSerializacion<T>(fn: () => Promise<T>, intentos = 30): Promise<T> {
  for (let intento = 1; intento <= intentos; intento++) {
    try {
      return await fn();
    } catch (e) {
      const esConflictoDeSerializacion =
        (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") ||
        (isWriteConflict(e));
      if (!esConflictoDeSerializacion || intento === intentos) throw e;
      await esperarBackoff(intento);
    }
  }
  throw new Error("No se pudo completar la reserva tras reintentos");
}

function isWriteConflict(error: unknown): boolean {
  // Prisma 7 con @prisma/adapter-pg traduce el serialization_failure (40001) de Postgres
  // a un DriverAdapterError con cause.kind === "TransactionWriteConflict" — NO a P2034.
  // Esto se confirmó contra el comportamiento real del adapter instalado (no asumido).
  if (typeof error !== "object" || error === null) return false;
  const e = error as { name?: unknown; cause?: unknown };
  if (e.name !== "DriverAdapterError") return false;
  const cause = e.cause as { kind?: unknown } | undefined;
  return cause?.kind === "TransactionWriteConflict";
}

export async function crearReservaConCupo(params: {
  clienteId: string;
  claseId: string;
  medio: "EFECTIVO" | null;
  pagoIdExistente?: string;
}): Promise<ResultadoReserva> {
  return conReintentoDeSerializacion(() =>
    prisma.$transaction(
      async (tx) => {
        const clase = await tx.clase.findUniqueOrThrow({
          where: { id: params.claseId },
          include: { servicio: true },
        });
        if (clase.cancelada) {
          throw new Error("La clase fue cancelada");
        }

        const confirmadas = await tx.reserva.count({
          where: { claseId: clase.id, estado: "CONFIRMADA" },
        });
        const estado = calcularEstadoReserva(confirmadas, clase.cupoMax);

        const cobertura = await cubreMensualidad(tx, params.clienteId, clase.servicio, clase.fecha);

        const requierePagoOnline =
          clase.servicio.precio > 0 &&
          !cobertura.cubierta &&
          !params.pagoIdExistente &&
          params.medio !== "EFECTIVO";
        if (requierePagoOnline) {
          throw new RequierePagoError();
        }

        const reserva = await tx.reserva.create({
          data: {
            clienteId: params.clienteId,
            claseId: clase.id,
            estado,
            viaMensualidad: cobertura.cubierta,
            pagoId: params.pagoIdExistente ?? undefined,
          },
        });

        if (!cobertura.cubierta && clase.servicio.precio > 0 && params.medio === "EFECTIVO") {
          const pago = await tx.pago.create({
            data: {
              clienteId: params.clienteId,
              tipo: "CLASE_SUELTA",
              medio: "EFECTIVO",
              monto: clase.servicio.precio,
              estado: "PENDIENTE",
            },
          });
          await tx.reserva.update({ where: { id: reserva.id }, data: { pagoId: pago.id } });
        }

        return {
          reservaId: reserva.id,
          estado,
          viaMensualidad: cobertura.cubierta,
          monto: cobertura.cubierta ? 0 : clase.servicio.precio,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  );
}