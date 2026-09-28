-- CreateEnum: canal por el que sale una orden (HU-16). OTRO es "la envié por mi cuenta".
CREATE TYPE "canal_envio" AS ENUM ('EMAIL', 'WHATSAPP', 'OTRO');

-- AlterTable: canal preferido del proveedor; NULL es automático.
ALTER TABLE "proveedor" ADD COLUMN "canal_preferido" "canal_envio";
ALTER TABLE "proveedor" ADD CONSTRAINT "proveedor_canal_preferido_check"
  CHECK ("canal_preferido" IS NULL OR "canal_preferido" <> 'OTRO');

-- AlterTable: canal con el que se confirmó o envió la orden.
ALTER TABLE "orden_compra" ADD COLUMN "canal" "canal_envio";

-- Las órdenes ya enviadas salieron por correo: era el único canal.
UPDATE "orden_compra" SET "canal" = 'EMAIL' WHERE "estado" = 'ENVIADA';
