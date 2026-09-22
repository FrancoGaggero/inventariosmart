-- CreateEnum
CREATE TYPE "tipo_gasto" AS ENUM ('FIJO', 'VARIABLE');

-- CreateEnum
CREATE TYPE "periodicidad_gasto" AS ENUM ('UNICO', 'MENSUAL', 'ANUAL');

-- CreateTable
CREATE TABLE "gasto" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "concepto" VARCHAR(120) NOT NULL,
    "tipo" "tipo_gasto" NOT NULL,
    "importe" DECIMAL(14,2) NOT NULL,
    "periodo" DATE NOT NULL,
    "periodicidad" "periodicidad_gasto" NOT NULL,
    "fin" DATE,
    "notas" VARCHAR(300),
    "usuario_id" UUID NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gasto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gasto_comercio_id_periodo_idx" ON "gasto"("comercio_id", "periodo");

-- AddForeignKey
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Reglas de integridad que Prisma no modela (design D1).
-- ---------------------------------------------------------------------------
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_importe_check" CHECK ("importe" > 0);
ALTER TABLE "gasto" ADD CONSTRAINT "gasto_fin_check" CHECK ("fin" IS NULL OR "fin" >= "periodo");

-- ---------------------------------------------------------------------------
-- Row Level Security (checklist de docs/runbooks/rls.md).
-- ---------------------------------------------------------------------------
ALTER TABLE "gasto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "gasto" FORCE ROW LEVEL SECURITY;
CREATE POLICY gasto_tenant ON "gasto"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY gasto_sistema ON "gasto"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());
