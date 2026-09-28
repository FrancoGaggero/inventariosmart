-- CreateEnum
CREATE TYPE "serie_indicador" AS ENUM ('IPC_GENERAL', 'IPC_BIENES', 'INFLACION_MENSUAL', 'INFLACION_INTERANUAL', 'USD_MINORISTA');
CREATE TYPE "origen_precio_venta" AS ENUM ('ALTA', 'EDICION', 'IMPORT', 'INICIAL');

-- CreateTable: indicadores económicos oficiales (HU-15). Dato público de referencia, igual para
-- todos los comercios: es la única tabla sin `comercio_id` (design D2, ADR 0014).
CREATE TABLE "indicador_economico" (
    "id" UUID NOT NULL,
    "serie" "serie_indicador" NOT NULL,
    "fecha" DATE NOT NULL,
    "valor" DECIMAL(18,4) NOT NULL,
    "fuente" VARCHAR(40) NOT NULL,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicador_economico_pkey" PRIMARY KEY ("id")
);

-- CreateTable: última consulta a cada fuente, para no llamarlas en cada pedido (design D4).
CREATE TABLE "indicador_actualizacion" (
    "fuente" VARCHAR(40) NOT NULL,
    "actualizado_en" TIMESTAMPTZ(3),
    "intentado_en" TIMESTAMPTZ(3),
    "ultimo_error" VARCHAR(300),

    CONSTRAINT "indicador_actualizacion_pkey" PRIMARY KEY ("fuente")
);

-- CreateTable: historial de precios de venta, sólo inserción (design D2, D5).
CREATE TABLE "precio_venta_historial" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "producto_id" UUID NOT NULL,
    "precio_venta" DECIMAL(14,2) NOT NULL,
    "alicuota_iva" DECIMAL(5,2) NOT NULL,
    "vigente_desde" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "origen" "origen_precio_venta" NOT NULL,
    "usuario_id" UUID,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precio_venta_historial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "indicador_economico_serie_fecha_key" ON "indicador_economico"("serie", "fecha");
CREATE INDEX "indicador_economico_serie_fecha_idx" ON "indicador_economico"("serie", "fecha" DESC);
CREATE INDEX "precio_venta_historial_comercio_id_producto_id_vigente_desd_idx" ON "precio_venta_historial"("comercio_id", "producto_id", "vigente_desde" DESC, "id" DESC);

-- AddForeignKey
ALTER TABLE "precio_venta_historial" ADD CONSTRAINT "precio_venta_historial_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "precio_venta_historial" ADD CONSTRAINT "precio_venta_historial_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "producto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "precio_venta_historial" ADD CONSTRAINT "precio_venta_historial_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integridad que Prisma no modela.
ALTER TABLE "precio_venta_historial" ADD CONSTRAINT "precio_venta_historial_precio_venta_check" CHECK ("precio_venta" >= 0);

-- ---------------------------------------------------------------------------
-- Relleno inicial del historial (design D2): cada cambio de precio observado en las ventas ya
-- registradas y, si difiere del último observado, el precio actual del producto.
-- ---------------------------------------------------------------------------
INSERT INTO "precio_venta_historial" ("id", "comercio_id", "producto_id", "precio_venta", "alicuota_iva", "vigente_desde", "origen")
SELECT gen_random_uuid(), p."comercio_id", p."id", v."precio", p."alicuota_iva", v."fecha", 'INICIAL'
FROM (
  SELECT m."producto_id", m."precio_unitario" AS "precio", m."fecha",
         lag(m."precio_unitario") OVER (PARTITION BY m."producto_id" ORDER BY m."fecha", m."creado_en") AS "anterior"
  FROM "movimiento" m
  WHERE m."tipo" = 'VENTA' AND m."precio_unitario" IS NOT NULL
) v
JOIN "producto" p ON p."id" = v."producto_id"
WHERE v."anterior" IS NULL OR v."anterior" <> v."precio";

INSERT INTO "precio_venta_historial" ("id", "comercio_id", "producto_id", "precio_venta", "alicuota_iva", "vigente_desde", "origen")
SELECT gen_random_uuid(), p."comercio_id", p."id", p."precio_venta", p."alicuota_iva",
       CASE WHEN u."vigente_desde" IS NULL THEN p."creado_en"
            ELSE GREATEST(p."actualizado_en", u."vigente_desde" + interval '1 second') END,
       'INICIAL'
FROM "producto" p
LEFT JOIN LATERAL (
  SELECT h."precio_venta", h."vigente_desde" FROM "precio_venta_historial" h
  WHERE h."producto_id" = p."id"
  ORDER BY h."vigente_desde" DESC LIMIT 1
) u ON true
WHERE u."precio_venta" IS NULL OR u."precio_venta" <> p."precio_venta";

-- ---------------------------------------------------------------------------
-- Row Level Security (checklist de docs/runbooks/rls.md).
-- ---------------------------------------------------------------------------
ALTER TABLE "precio_venta_historial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "precio_venta_historial" FORCE ROW LEVEL SECURITY;
CREATE POLICY precio_venta_historial_tenant ON "precio_venta_historial"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY precio_venta_historial_sistema ON "precio_venta_historial"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

-- Historial de sólo inserción, como `precio_proveedor`.
GRANT SELECT, INSERT ON "precio_venta_historial" TO app_api;
REVOKE UPDATE, DELETE ON "precio_venta_historial" FROM app_api;

-- Tablas de referencia: cualquiera las lee, sólo el contexto de sistema las escribe.
ALTER TABLE "indicador_economico" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "indicador_economico" FORCE ROW LEVEL SECURITY;
CREATE POLICY indicador_economico_lectura ON "indicador_economico"
  FOR SELECT USING (true);
CREATE POLICY indicador_economico_sistema ON "indicador_economico"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

ALTER TABLE "indicador_actualizacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "indicador_actualizacion" FORCE ROW LEVEL SECURITY;
CREATE POLICY indicador_actualizacion_lectura ON "indicador_actualizacion"
  FOR SELECT USING (true);
CREATE POLICY indicador_actualizacion_sistema ON "indicador_actualizacion"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

GRANT SELECT, INSERT, UPDATE ON "indicador_economico" TO app_api;
REVOKE DELETE ON "indicador_economico" FROM app_api;
GRANT SELECT, INSERT, UPDATE ON "indicador_actualizacion" TO app_api;
REVOKE DELETE ON "indicador_actualizacion" FROM app_api;
