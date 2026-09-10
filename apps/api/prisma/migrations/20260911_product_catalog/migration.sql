-- CreateTable
CREATE TABLE "producto" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "codigo" VARCHAR(64) NOT NULL,
    "codigo_normalizado" VARCHAR(64) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "categoria" VARCHAR(60),
    "precio_venta" DECIMAL(14,2) NOT NULL,
    "alicuota_iva" DECIMAL(5,2) NOT NULL,
    "costo_reposicion" DECIMAL(14,2) NOT NULL,
    "stock_actual" INTEGER NOT NULL DEFAULT 0,
    "stock_seguridad" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "producto_comercio_id_activo_nombre_idx" ON "producto"("comercio_id", "activo", "nombre");

-- CreateIndex
CREATE UNIQUE INDEX "producto_comercio_id_codigo_normalizado_key" ON "producto"("comercio_id", "codigo_normalizado");

-- AddForeignKey
ALTER TABLE "producto" ADD CONSTRAINT "producto_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Búsqueda: índice trigram sobre el nombre (pg_trgm, disponible en Neon) y
-- prefijo sobre el código normalizado.
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "producto_nombre_trgm_idx" ON "producto" USING gin ("nombre" gin_trgm_ops);
CREATE INDEX "producto_codigo_normalizado_idx" ON "producto" ("comercio_id", "codigo_normalizado" varchar_pattern_ops);

-- ---------------------------------------------------------------------------
-- Row Level Security (checklist de docs/runbooks/rls.md).
-- ---------------------------------------------------------------------------
ALTER TABLE "producto" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "producto" FORCE ROW LEVEL SECURITY;
CREATE POLICY producto_tenant ON "producto"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY producto_sistema ON "producto"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());
GRANT SELECT, INSERT, UPDATE, DELETE ON "producto" TO app_api;
