-- CreateEnum
CREATE TYPE "motivo_no_envio_reporte" AS ENUM ('SIN_PROVEEDOR', 'ENVIO_FALLIDO', 'SIN_DESTINATARIOS');

-- AlterTable: ajustes del reporte semanal por comercio (HU-09).
ALTER TABLE "comercio" ADD COLUMN "reportes_activos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "comercio" ADD COLUMN "reportes_destinatarios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateTable: un reporte por comercio y semana ISO, con el contenido tal como se envió (design D2).
CREATE TABLE "reporte_semanal" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "semana" VARCHAR(8) NOT NULL,
    "desde" TIMESTAMPTZ(3) NOT NULL,
    "hasta" TIMESTAMPTZ(3) NOT NULL,
    "contenido" JSONB NOT NULL,
    "destinatarios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "enviado_en" TIMESTAMPTZ(3),
    "motivo_no_envio" "motivo_no_envio_reporte",
    "generado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporte_semanal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reporte_semanal_comercio_id_semana_key" ON "reporte_semanal"("comercio_id", "semana");
CREATE INDEX "reporte_semanal_comercio_id_semana_idx" ON "reporte_semanal"("comercio_id", "semana" DESC);

-- AddForeignKey
ALTER TABLE "reporte_semanal" ADD CONSTRAINT "reporte_semanal_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integridad que Prisma no modela.
ALTER TABLE "reporte_semanal" ADD CONSTRAINT "reporte_semanal_semana_check"
  CHECK ("semana" ~ '^[0-9]{4}-W[0-9]{2}$');
ALTER TABLE "reporte_semanal" ADD CONSTRAINT "reporte_semanal_rango_check" CHECK ("hasta" > "desde");

-- ---------------------------------------------------------------------------
-- Row Level Security (checklist de docs/runbooks/rls.md).
-- ---------------------------------------------------------------------------
ALTER TABLE "reporte_semanal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reporte_semanal" FORCE ROW LEVEL SECURITY;
CREATE POLICY reporte_semanal_tenant ON "reporte_semanal"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY reporte_semanal_sistema ON "reporte_semanal"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

-- El historial de reportes no se borra.
GRANT SELECT, INSERT, UPDATE ON "reporte_semanal" TO app_api;
REVOKE DELETE ON "reporte_semanal" FROM app_api;
