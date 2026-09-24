-- CreateEnum
CREATE TYPE "estado_orden_compra" AS ENUM ('BORRADOR', 'CONFIRMADA', 'ENVIADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "motivo_no_envio" AS ENUM ('SIN_EMAIL', 'ENVIO_FALLIDO');

-- CreateTable: orden de compra en modo copiloto (HU-07, RN-06). Se cancela, no se borra.
CREATE TABLE "orden_compra" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "proveedor_id" UUID NOT NULL,
    "estado" "estado_orden_compra" NOT NULL DEFAULT 'BORRADOR',
    "asunto" VARCHAR(200) NOT NULL,
    "texto" TEXT NOT NULL,
    "texto_editado" BOOLEAN NOT NULL DEFAULT false,
    "notas" VARCHAR(500),
    "total_neto" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "motivo_no_envio" "motivo_no_envio",
    "creada_por_id" UUID NOT NULL,
    "confirmada_por_id" UUID,
    "confirmada_en" TIMESTAMPTZ(3),
    "enviada_en" TIMESTAMPTZ(3),
    "enviada_a" VARCHAR(254),
    "cancelada_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orden_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ítems con cantidad y costo neto al momento (snapshot).
CREATE TABLE "orden_compra_item" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "orden_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "alerta_id" UUID,
    "cantidad" INTEGER NOT NULL,
    "costo_unitario_neto" DECIMAL(14,2),

    CONSTRAINT "orden_compra_item_pkey" PRIMARY KEY ("id")
);

-- AlterTable: la alerta recuerda qué orden la atendió.
ALTER TABLE "alerta" ADD COLUMN "orden_compra_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "orden_compra_comercio_id_numero_key" ON "orden_compra"("comercio_id", "numero");
CREATE INDEX "orden_compra_comercio_id_creado_en_id_idx" ON "orden_compra"("comercio_id", "creado_en" DESC, "id" DESC);
CREATE INDEX "orden_compra_comercio_id_estado_idx" ON "orden_compra"("comercio_id", "estado");
CREATE INDEX "orden_compra_proveedor_id_idx" ON "orden_compra"("proveedor_id");
CREATE UNIQUE INDEX "orden_compra_item_orden_id_producto_id_key" ON "orden_compra_item"("orden_id", "producto_id");
CREATE INDEX "orden_compra_item_comercio_id_producto_id_idx" ON "orden_compra_item"("comercio_id", "producto_id");
CREATE INDEX "alerta_orden_compra_id_idx" ON "alerta"("orden_compra_id");

-- AddForeignKey
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_creada_por_id_fkey" FOREIGN KEY ("creada_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_confirmada_por_id_fkey" FOREIGN KEY ("confirmada_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orden_compra_item" ADD CONSTRAINT "orden_compra_item_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orden_compra_item" ADD CONSTRAINT "orden_compra_item_orden_id_fkey" FOREIGN KEY ("orden_id") REFERENCES "orden_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "orden_compra_item" ADD CONSTRAINT "orden_compra_item_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orden_compra_item" ADD CONSTRAINT "orden_compra_item_alerta_id_fkey" FOREIGN KEY ("alerta_id") REFERENCES "alerta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_orden_compra_id_fkey" FOREIGN KEY ("orden_compra_id") REFERENCES "orden_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Reglas de integridad que Prisma no modela (design D2).
-- ---------------------------------------------------------------------------
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_numero_check" CHECK ("numero" > 0);
ALTER TABLE "orden_compra" ADD CONSTRAINT "orden_compra_total_check" CHECK ("total_neto" >= 0);
ALTER TABLE "orden_compra_item" ADD CONSTRAINT "orden_compra_item_cantidad_check" CHECK ("cantidad" > 0);
ALTER TABLE "orden_compra_item" ADD CONSTRAINT "orden_compra_item_costo_check"
  CHECK ("costo_unitario_neto" IS NULL OR "costo_unitario_neto" >= 0);

-- ---------------------------------------------------------------------------
-- Row Level Security (checklist de docs/runbooks/rls.md).
-- ---------------------------------------------------------------------------
ALTER TABLE "orden_compra" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orden_compra" FORCE ROW LEVEL SECURITY;
CREATE POLICY orden_compra_tenant ON "orden_compra"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY orden_compra_sistema ON "orden_compra"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

ALTER TABLE "orden_compra_item" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orden_compra_item" FORCE ROW LEVEL SECURITY;
CREATE POLICY orden_compra_item_tenant ON "orden_compra_item"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY orden_compra_item_sistema ON "orden_compra_item"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

-- Las órdenes no se borran (se cancelan); los ítems de un borrador sí se reemplazan.
GRANT SELECT, INSERT, UPDATE ON "orden_compra" TO app_api;
REVOKE DELETE ON "orden_compra" FROM app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON "orden_compra_item" TO app_api;
