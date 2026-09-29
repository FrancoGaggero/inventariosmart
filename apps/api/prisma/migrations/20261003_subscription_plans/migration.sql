-- CreateTable: historial de cambios de plan del comercio (HU-14, design D5). Sólo inserción.
-- Los cambios hechos a mano en la base antes de esta migración no tienen registro.
CREATE TABLE "cambio_plan" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "plan_anterior" "plan" NOT NULL,
    "plan_nuevo" "plan" NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cambio_plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cambio_plan_comercio_id_creado_en_id_idx" ON "cambio_plan"("comercio_id", "creado_en" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "cambio_plan" ADD CONSTRAINT "cambio_plan_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cambio_plan" ADD CONSTRAINT "cambio_plan_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Integridad que Prisma no modela: un cambio siempre pasa de un plan a otro distinto.
ALTER TABLE "cambio_plan" ADD CONSTRAINT "cambio_plan_distintos_check" CHECK ("plan_anterior" <> "plan_nuevo");

-- ---------------------------------------------------------------------------
-- Row Level Security (checklist de docs/runbooks/rls.md).
-- ---------------------------------------------------------------------------
ALTER TABLE "cambio_plan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cambio_plan" FORCE ROW LEVEL SECURITY;
CREATE POLICY cambio_plan_tenant ON "cambio_plan"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY cambio_plan_sistema ON "cambio_plan"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

-- El historial no se modifica ni se borra.
GRANT SELECT, INSERT ON "cambio_plan" TO app_api;
REVOKE UPDATE, DELETE ON "cambio_plan" FROM app_api;
