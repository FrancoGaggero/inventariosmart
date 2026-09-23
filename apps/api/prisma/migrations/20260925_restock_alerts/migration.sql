-- CreateEnum
CREATE TYPE "estado_alerta" AS ENUM ('ACTIVA', 'POSPUESTA', 'ATENDIDA', 'RESUELTA');

-- CreateEnum
CREATE TYPE "severidad_alerta" AS ENUM ('PROXIMA', 'CRITICA');

-- AlterTable: umbral de alerta por producto (HU-06 criterio 4) y marca del último cálculo.
ALTER TABLE "producto" ADD COLUMN "dias_anticipacion_alerta" SMALLINT NOT NULL DEFAULT 3;
ALTER TABLE "comercio" ADD COLUMN "alertas_calculadas_en" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "alerta" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "estado" "estado_alerta" NOT NULL DEFAULT 'ACTIVA',
    "severidad" "severidad_alerta" NOT NULL,
    "stock" INTEGER NOT NULL,
    "velocidad_diaria" DECIMAL(10,3) NOT NULL,
    "dias_cobertura" INTEGER,
    "punto_reposicion" INTEGER NOT NULL,
    "umbral" INTEGER NOT NULL,
    "lead_time_dias" INTEGER NOT NULL,
    "dias_anticipacion" INTEGER NOT NULL,
    "cantidad_sugerida" INTEGER NOT NULL,
    "generada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pospuesta_hasta" TIMESTAMPTZ(3),
    "atendida_en" TIMESTAMPTZ(3),
    "resuelta_en" TIMESTAMPTZ(3),
    "notificada_en" TIMESTAMPTZ(3),

    CONSTRAINT "alerta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alerta_comercio_id_estado_dias_cobertura_idx" ON "alerta"("comercio_id", "estado", "dias_cobertura");

-- CreateIndex
CREATE INDEX "alerta_producto_id_idx" ON "alerta"("producto_id");

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Reglas de integridad que Prisma no modela (design D2).
-- ---------------------------------------------------------------------------
ALTER TABLE "producto" ADD CONSTRAINT "producto_dias_anticipacion_alerta_check"
  CHECK ("dias_anticipacion_alerta" BETWEEN 0 AND 90);
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_cifras_check"
  CHECK ("stock" >= 0 AND "velocidad_diaria" >= 0 AND "punto_reposicion" >= 0 AND "umbral" >= 0
         AND "lead_time_dias" >= 0 AND "dias_anticipacion" BETWEEN 0 AND 90 AND "cantidad_sugerida" >= 0);
-- A lo sumo una alerta abierta por producto.
CREATE UNIQUE INDEX "alerta_producto_abierta_uidx" ON "alerta"("producto_id")
  WHERE "estado" IN ('ACTIVA', 'POSPUESTA');

-- ---------------------------------------------------------------------------
-- Row Level Security (checklist de docs/runbooks/rls.md).
-- ---------------------------------------------------------------------------
ALTER TABLE "alerta" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "alerta" FORCE ROW LEVEL SECURITY;
CREATE POLICY alerta_tenant ON "alerta"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY alerta_sistema ON "alerta"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

-- El historial de alertas no se borra: se cierra con estado RESUELTA o ATENDIDA.
GRANT SELECT, INSERT, UPDATE ON "alerta" TO app_api;
REVOKE DELETE ON "alerta" FROM app_api;
