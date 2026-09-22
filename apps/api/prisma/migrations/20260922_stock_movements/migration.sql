-- CreateEnum
CREATE TYPE "tipo_movimiento" AS ENUM ('VENTA', 'INGRESO', 'AJUSTE');

-- CreateEnum
CREATE TYPE "motivo_movimiento" AS ENUM ('STOCK_INICIAL', 'COMPRA', 'DEVOLUCION', 'INVENTARIO', 'ROTURA', 'VENCIMIENTO', 'ROBO', 'USO_INTERNO', 'ANULACION', 'OTRO');

-- CreateTable
CREATE TABLE "movimiento" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "tipo" "tipo_movimiento" NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "efecto_stock" INTEGER NOT NULL,
    "stock_resultante" INTEGER NOT NULL,
    "precio_unitario" DECIMAL(14,2),
    "motivo" "motivo_movimiento",
    "observacion" VARCHAR(200),
    "fecha" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "corrige_a_id" UUID,
    "anulado_por_id" UUID,
    "clave_idempotencia" VARCHAR(64),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_corrige_a_id_key" ON "movimiento"("corrige_a_id");

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_anulado_por_id_key" ON "movimiento"("anulado_por_id");

-- CreateIndex
CREATE INDEX "movimiento_comercio_id_fecha_id_idx" ON "movimiento"("comercio_id", "fecha" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "movimiento_comercio_id_producto_id_fecha_id_idx" ON "movimiento"("comercio_id", "producto_id", "fecha" DESC, "id" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "movimiento_comercio_id_clave_idempotencia_key" ON "movimiento"("comercio_id", "clave_idempotencia");

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_corrige_a_id_fkey" FOREIGN KEY ("corrige_a_id") REFERENCES "movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_anulado_por_id_fkey" FOREIGN KEY ("anulado_por_id") REFERENCES "movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Reglas de integridad que Prisma no modela (design D1):
-- un movimiento siempre mueve stock, y el stock nunca queda negativo.
-- ---------------------------------------------------------------------------
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_efecto_stock_check" CHECK ("efecto_stock" <> 0);
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_stock_resultante_check" CHECK ("stock_resultante" >= 0);
ALTER TABLE "producto" ADD CONSTRAINT "producto_stock_actual_check" CHECK ("stock_actual" >= 0);

-- ---------------------------------------------------------------------------
-- Row Level Security (checklist de docs/runbooks/rls.md).
-- ---------------------------------------------------------------------------
ALTER TABLE "movimiento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "movimiento" FORCE ROW LEVEL SECURITY;
CREATE POLICY movimiento_tenant ON "movimiento"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY movimiento_sistema ON "movimiento"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

-- ---------------------------------------------------------------------------
-- Inmutabilidad (RN-07) garantizada por la base (design D2): la API sólo inserta
-- y marca el original como anulado. Los privilegios por defecto ya dieron
-- SELECT/INSERT/UPDATE/DELETE; se recorta a lo necesario.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT ON "movimiento" TO app_api;
REVOKE UPDATE, DELETE ON "movimiento" FROM app_api;
GRANT UPDATE ("anulado_por_id") ON "movimiento" TO app_api;

-- ---------------------------------------------------------------------------
-- Backfill (design D6): los productos creados antes de HU-10 reciben su
-- INGRESO de stock inicial, con la fecha del alta y el dueño más antiguo.
-- ---------------------------------------------------------------------------
INSERT INTO "movimiento" ("id", "comercio_id", "producto_id", "usuario_id", "tipo", "cantidad", "efecto_stock", "stock_resultante", "motivo", "fecha", "creado_en")
SELECT gen_random_uuid(), p."comercio_id", p."id", u."id", 'INGRESO', p."stock_actual", p."stock_actual", p."stock_actual", 'STOCK_INICIAL', p."creado_en", CURRENT_TIMESTAMP
FROM "producto" p
JOIN LATERAL (
  SELECT "id" FROM "usuario"
  WHERE "comercio_id" = p."comercio_id" AND "rol" = 'DUENIO' AND "activo"
  ORDER BY "creado_en" LIMIT 1
) u ON true
WHERE p."stock_actual" > 0
  AND NOT EXISTS (SELECT 1 FROM "movimiento" m WHERE m."producto_id" = p."id");
