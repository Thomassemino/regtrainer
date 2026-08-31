-- AlterTable
ALTER TABLE "Servicio" ADD COLUMN     "descripcion" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "imagenUrl" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "PlanPrecio" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "precio" INTEGER NOT NULL,
    "unidad" TEXT NOT NULL,
    "badge" TEXT NOT NULL DEFAULT '',
    "feats" TEXT[],
    "orden" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanPrecio_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanPrecio_slug_key" ON "PlanPrecio"("slug");
