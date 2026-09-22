-- CreateEnum
CREATE TYPE "origen_precio" AS ENUM ('MANUAL', 'IMPORT');

-- AlterTable
ALTER TABLE "producto" ADD COLUMN     "proveedor_principal_id" UUID;

-- CreateTable
CREATE TABLE "proveedor" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "nombre_normalizado" VARCHAR(120) NOT NULL,
    "contacto" VARCHAR(120),
    "email" VARCHAR(254),
    "telefono" VARCHAR(40),
    "cuit" VARCHAR(13),
    "lead_time_dias" INTEGER NOT NULL DEFAULT 7,
    "confiabilidad" SMALLINT NOT NULL DEFAULT 3,
    "notas" VARCHAR(500),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "precio_proveedor" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "proveedor_id" UUID NOT NULL,
    "costo_neto" DECIMAL(14,2) NOT NULL,
    "vigente_desde" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" "origen_precio" NOT NULL,
    "lote_id" UUID,
    "usuario_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precio_proveedor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proveedor_comercio_id_activo_nombre_idx" ON "proveedor"("comercio_id", "activo", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "proveedor_comercio_id_nombre_normalizado_key" ON "proveedor"("comercio_id", "nombre_normalizado");

-- CreateIndex
CREATE INDEX "precio_proveedor_comercio_id_proveedor_id_producto_id_vigen_idx" ON "precio_proveedor"("comercio_id", "proveedor_id", "producto_id", "vigente_desde" DESC, "creado_en" DESC);

-- CreateIndex
CREATE INDEX "precio_proveedor_comercio_id_producto_id_vigente_desde_id_idx" ON "precio_proveedor"("comercio_id", "producto_id", "vigente_desde" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "producto_proveedor_principal_id_idx" ON "producto"("proveedor_principal_id");

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_proveedor_principal_id_fkey" FOREIGN KEY ("proveedor_principal_id") REFERENCES "proveedor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proveedor" ADD CONSTRAINT "proveedor_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precio_proveedor" ADD CONSTRAINT "precio_proveedor_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precio_proveedor" ADD CONSTRAINT "precio_proveedor_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precio_proveedor" ADD CONSTRAINT "precio_proveedor_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "proveedor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "precio_proveedor" ADD CONSTRAINT "precio_proveedor_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Reglas de integridad que Prisma no modela (design D1, D2).
-- ---------------------------------------------------------------------------
ALTER TABLE "proveedor" ADD CONSTRAINT "proveedor_lead_time_dias_check" CHECK ("lead_time_dias" >= 0);
ALTER TABLE "proveedor" ADD CONSTRAINT "proveedor_confiabilidad_check" CHECK ("confiabilidad" BETWEEN 1 AND 5);
ALTER TABLE "precio_proveedor" ADD CONSTRAINT "precio_proveedor_costo_neto_check" CHECK ("costo_neto" >= 0);

-- ---------------------------------------------------------------------------
-- Row Level Security (checklist de docs/runbooks/rls.md).
-- ---------------------------------------------------------------------------
ALTER TABLE "proveedor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "proveedor" FORCE ROW LEVEL SECURITY;
CREATE POLICY proveedor_tenant ON "proveedor"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY proveedor_sistema ON "proveedor"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

ALTER TABLE "precio_proveedor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "precio_proveedor" FORCE ROW LEVEL SECURITY;
CREATE POLICY precio_proveedor_tenant ON "precio_proveedor"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY precio_proveedor_sistema ON "precio_proveedor"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

-- ---------------------------------------------------------------------------
-- Historial de costos de sólo inserción (RN-08, ADR 0007): como `movimiento`.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT ON "precio_proveedor" TO app_api;
REVOKE UPDATE, DELETE ON "precio_proveedor" FROM app_api;
