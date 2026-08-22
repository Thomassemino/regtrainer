-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('CONFIRMADA', 'LISTA_ESPERA', 'CANCELADA', 'ASISTIO', 'NO_ASISTIO');

-- CreateEnum
CREATE TYPE "EstadoSuscripcion" AS ENUM ('ACTIVA', 'CANCELADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "TipoPago" AS ENUM ('CLASE_SUELTA', 'MENSUALIDAD');

-- CreateEnum
CREATE TYPE "MedioPago" AS ENUM ('MERCADO_PAGO', 'EFECTIVO');

-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO');

-- CreateTable
CREATE TABLE "Servicio" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "duracionMin" INTEGER NOT NULL,
    "precio" INTEGER NOT NULL,
    "cupoMax" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Servicio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorarioRecurrente" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HorarioRecurrente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clase" (
    "id" TEXT NOT NULL,
    "servicioId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "cupoMax" INTEGER NOT NULL,
    "cancelada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Clase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reserva" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'CONFIRMADA',
    "pagoId" TEXT,
    "viaMensualidad" BOOLEAN NOT NULL DEFAULT false,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canceladaEn" TIMESTAMP(3),
    "canceladaTarde" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Reserva_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suscripcion" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "estado" "EstadoSuscripcion" NOT NULL DEFAULT 'ACTIVA',
    "precio" INTEGER NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaProximoCobro" TIMESTAMP(3) NOT NULL,
    "mpPreapprovalId" TEXT,
    "canceladaEn" TIMESTAMP(3),

    CONSTRAINT "Suscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pago" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "tipo" "TipoPago" NOT NULL,
    "medio" "MedioPago" NOT NULL,
    "monto" INTEGER NOT NULL,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "mpPaymentId" TEXT,
    "suscripcionId" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Servicio_slug_key" ON "Servicio"("slug");

-- CreateIndex
CREATE INDEX "Clase_fecha_idx" ON "Clase"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Clase_servicioId_fecha_key" ON "Clase"("servicioId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Reserva_pagoId_key" ON "Reserva"("pagoId");

-- CreateIndex
CREATE INDEX "Reserva_claseId_estado_idx" ON "Reserva"("claseId", "estado");

-- CreateIndex
CREATE INDEX "Reserva_clienteId_idx" ON "Reserva"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Suscripcion_clienteId_key" ON "Suscripcion"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "Suscripcion_mpPreapprovalId_key" ON "Suscripcion"("mpPreapprovalId");

-- CreateIndex
CREATE UNIQUE INDEX "Pago_mpPaymentId_key" ON "Pago"("mpPaymentId");

-- CreateIndex
CREATE INDEX "Pago_mpPaymentId_idx" ON "Pago"("mpPaymentId");

-- AddForeignKey
ALTER TABLE "HorarioRecurrente" ADD CONSTRAINT "HorarioRecurrente_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_servicioId_fkey" FOREIGN KEY ("servicioId") REFERENCES "Servicio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserva" ADD CONSTRAINT "Reserva_pagoId_fkey" FOREIGN KEY ("pagoId") REFERENCES "Pago"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suscripcion" ADD CONSTRAINT "Suscripcion_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pago" ADD CONSTRAINT "Pago_suscripcionId_fkey" FOREIGN KEY ("suscripcionId") REFERENCES "Suscripcion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

