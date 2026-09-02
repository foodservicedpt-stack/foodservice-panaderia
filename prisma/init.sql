-- CreateEnum
CREATE TYPE "Categoria" AS ENUM ('STOCK', 'SEMANAL', 'OTRO');
CREATE TYPE "EstadoAmasadora" AS ENUM ('EN_FERMENTACION', 'PENDIENTE_CONFIRMAR', 'COMPLETADA');
CREATE TYPE "TipoMovimiento" AS ENUM ('AMASADA', 'AJUSTE', 'CONSUMO', 'CORRECCION', 'COMPRA');

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "categoria" "Categoria" NOT NULL DEFAULT 'STOCK',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "margenSeguridadDias" INTEGER NOT NULL DEFAULT 2,
    "margenSeguridadUnidades" INTEGER NOT NULL DEFAULT 0,
    "stockActual" INTEGER NOT NULL DEFAULT 0,
    "consumoDiarioDefecto" INTEGER NOT NULL DEFAULT 10,
    "diaSemanal" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "PlanificacionDia" (
    "id" SERIAL PRIMARY KEY,
    "productoId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "desayuno" INTEGER NOT NULL DEFAULT 0,
    "comida" INTEGER NOT NULL DEFAULT 0,
    "extra" INTEGER NOT NULL DEFAULT 0,
    "esExcepcion" BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "PlanificacionDia_productoId_fecha_key" ON "PlanificacionDia"("productoId", "fecha");
CREATE INDEX "PlanificacionDia_fecha_idx" ON "PlanificacionDia"("fecha");
ALTER TABLE "PlanificacionDia" ADD CONSTRAINT "PlanificacionDia_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Amasadora" (
    "id" SERIAL PRIMARY KEY,
    "productoId" INTEGER NOT NULL,
    "fechaInicio" DATE NOT NULL,
    "estado" "EstadoAmasadora" NOT NULL DEFAULT 'EN_FERMENTACION',
    "piezasProducidas" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
ALTER TABLE "Amasadora" ADD CONSTRAINT "Amasadora_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MovimientoInventario" (
    "id" SERIAL PRIMARY KEY,
    "productoId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "notas" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MovimientoInventario_productoId_fecha_idx" ON "MovimientoInventario"("productoId", "fecha");
ALTER TABLE "MovimientoInventario" ADD CONSTRAINT "MovimientoInventario_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AppConfig" (
    "id" SERIAL PRIMARY KEY,
    "clave" TEXT NOT NULL,
    "valor" TEXT NOT NULL
);
CREATE UNIQUE INDEX "AppConfig_clave_key" ON "AppConfig"("clave");

CREATE TABLE "NotaDia" (
    "id" SERIAL PRIMARY KEY,
    "fecha" DATE NOT NULL,
    "nota" TEXT NOT NULL
);
CREATE UNIQUE INDEX "NotaDia_fecha_key" ON "NotaDia"("fecha");

CREATE TABLE "OrdenTrabajoItem" (
    "id" SERIAL PRIMARY KEY,
    "productoId" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "completado" BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX "OrdenTrabajoItem_productoId_fecha_key" ON "OrdenTrabajoItem"("productoId", "fecha");
ALTER TABLE "OrdenTrabajoItem" ADD CONSTRAINT "OrdenTrabajoItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
