-- AlterEnum: origen de las filas del historial que deja una remarcación en lote (HU-17).
-- Sólo se agrega el valor: PostgreSQL no deja usarlo en la misma transacción que lo crea.
ALTER TYPE "origen_precio_venta" ADD VALUE 'REMARCACION';

-- CreateEnum
CREATE TYPE "criterio_remarcacion" AS ENUM ('INFLACION', 'MARGEN', 'PORCENTAJE', 'MARGEN_OBJETIVO');

-- CreateTable: una remarcación aplicada, con su criterio y quién la hizo (design D2).
CREATE TABLE "remarcacion" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "criterio" "criterio_remarcacion" NOT NULL,
    "parametros" JSONB NOT NULL DEFAULT '{}',
    "cantidad" INTEGER NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revertido_en" TIMESTAMPTZ(3),
    "revertido_por_id" UUID,
    "revertidos" INTEGER,
    "omitidos" INTEGER,

    CONSTRAINT "remarcacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: precio anterior y nuevo de cada producto del lote.
CREATE TABLE "remarcacion_item" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "remarcacion_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "precio_anterior" DECIMAL(14,2) NOT NULL,
    "precio_nuevo" DECIMAL(14,2) NOT NULL,
    "revertido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "remarcacion_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "remarcacion_comercio_id_creado_en_id_idx" ON "remarcacion"("comercio_id", "creado_en" DESC, "id" DESC);
CREATE UNIQUE INDEX "remarcacion_item_remarcacion_id_producto_id_key" ON "remarcacion_item"("remarcacion_id", "producto_id");
CREATE INDEX "remarcacion_item_comercio_id_producto_id_idx" ON "remarcacion_item"("comercio_id", "producto_id");

-- AddForeignKey
ALTER TABLE "remarcacion" ADD CONSTRAINT "remarcacion_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "remarcacion" ADD CONSTRAINT "remarcacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "remarcacion" ADD CONSTRAINT "remarcacion_revertido_por_id_fkey" FOREIGN KEY ("revertido_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "remarcacion_item" ADD CONSTRAINT "remarcacion_item_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "remarcacion_item" ADD CONSTRAINT "remarcacion_item_remarcacion_id_fkey" FOREIGN KEY ("remarcacion_id") REFERENCES "remarcacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "remarcacion_item" ADD CONSTRAINT "remarcacion_item_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integridad que Prisma no modela.
ALTER TABLE "remarcacion" ADD CONSTRAINT "remarcacion_cantidad_check" CHECK ("cantidad" > 0);
ALTER TABLE "remarcacion_item" ADD CONSTRAINT "remarcacion_item_precios_check"
  CHECK ("precio_anterior" >= 0 AND "precio_nuevo" > 0 AND "precio_nuevo" <> "precio_anterior");

-- ---------------------------------------------------------------------------
-- Row Level Security (checklist de docs/runbooks/rls.md).
-- ---------------------------------------------------------------------------
ALTER TABLE "remarcacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "remarcacion" FORCE ROW LEVEL SECURITY;
CREATE POLICY remarcacion_tenant ON "remarcacion"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY remarcacion_sistema ON "remarcacion"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

ALTER TABLE "remarcacion_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "remarcacion_item" FORCE ROW LEVEL SECURITY;
CREATE POLICY remarcacion_item_tenant ON "remarcacion_item"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY remarcacion_item_sistema ON "remarcacion_item"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

-- Los lotes se actualizan al deshacer y no se borran.
GRANT SELECT, INSERT, UPDATE ON "remarcacion" TO app_api;
REVOKE DELETE ON "remarcacion" FROM app_api;
GRANT SELECT, INSERT, UPDATE ON "remarcacion_item" TO app_api;
REVOKE DELETE ON "remarcacion_item" FROM app_api;
