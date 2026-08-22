-- CreateEnum
CREATE TYPE "EstadoPrograma" AS ENUM ('BORRADOR', 'ASIGNADO', 'COMPLETADO', 'ARCHIVADO');

-- CreateEnum
CREATE TYPE "TipoBloque" AS ENUM ('TRADICIONAL', 'SECUENCIA', 'SUPERSERIE', 'EMOM', 'POR_TIEMPO');

-- CreateEnum
CREATE TYPE "Foco" AS ENUM ('TECNICA', 'RITMO', 'MAXIMO_ESFUERZO');

-- CreateTable
CREATE TABLE "Programa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "semanas" INTEGER NOT NULL,
    "objetivo" TEXT NOT NULL,
    "frecuencia" TEXT NOT NULL,
    "estado" "EstadoPrograma" NOT NULL DEFAULT 'BORRADOR',
    "creadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaPrograma" (
    "id" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "descanso" BOOLEAN NOT NULL DEFAULT false,
    "calentamiento" TEXT,

    CONSTRAINT "DiaPrograma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloque" (
    "id" TEXT NOT NULL,
    "diaId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL,
    "tipo" "TipoBloque" NOT NULL,
    "foco" "Foco" NOT NULL,
    "titulo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL,
    "meta" TEXT,

    CONSTRAINT "Bloque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilaSobrecarga" (
    "id" TEXT NOT NULL,
    "bloqueId" TEXT NOT NULL,
    "semana" INTEGER NOT NULL,
    "series" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "pct" INTEGER NOT NULL,
    "descanso" TEXT NOT NULL,

    CONSTRAINT "FilaSobrecarga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionPrograma" (
    "id" TEXT NOT NULL,
    "programaId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "asignadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mensajePersonalizado" TEXT,
    "temaPdf" TEXT NOT NULL DEFAULT 'clean',

    CONSTRAINT "AsignacionPrograma_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloqueCompletado" (
    "id" TEXT NOT NULL,
    "asignacionId" TEXT NOT NULL,
    "bloqueId" TEXT NOT NULL,
    "semana" INTEGER NOT NULL,
    "completadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloqueCompletado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiaPrograma_programaId_diaSemana_key" ON "DiaPrograma"("programaId", "diaSemana");

-- CreateIndex
CREATE INDEX "Bloque_diaId_orden_idx" ON "Bloque"("diaId", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "FilaSobrecarga_bloqueId_semana_key" ON "FilaSobrecarga"("bloqueId", "semana");

-- CreateIndex
CREATE UNIQUE INDEX "AsignacionPrograma_programaId_clienteId_key" ON "AsignacionPrograma"("programaId", "clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "BloqueCompletado_asignacionId_bloqueId_semana_key" ON "BloqueCompletado"("asignacionId", "bloqueId", "semana");

-- AddForeignKey
ALTER TABLE "Programa" ADD CONSTRAINT "Programa_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaPrograma" ADD CONSTRAINT "DiaPrograma_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloque" ADD CONSTRAINT "Bloque_diaId_fkey" FOREIGN KEY ("diaId") REFERENCES "DiaPrograma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilaSobrecarga" ADD CONSTRAINT "FilaSobrecarga_bloqueId_fkey" FOREIGN KEY ("bloqueId") REFERENCES "Bloque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionPrograma" ADD CONSTRAINT "AsignacionPrograma_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "Programa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionPrograma" ADD CONSTRAINT "AsignacionPrograma_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloqueCompletado" ADD CONSTRAINT "BloqueCompletado_asignacionId_fkey" FOREIGN KEY ("asignacionId") REFERENCES "AsignacionPrograma"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloqueCompletado" ADD CONSTRAINT "BloqueCompletado_bloqueId_fkey" FOREIGN KEY ("bloqueId") REFERENCES "Bloque"("id") ON DELETE CASCADE ON UPDATE CASCADE;

