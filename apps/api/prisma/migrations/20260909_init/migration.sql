-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "plan" AS ENUM ('FREE', 'PRO', 'PREMIUM');

-- CreateEnum
CREATE TYPE "rol" AS ENUM ('DUENIO', 'EMPLEADO', 'CONTADOR');

-- CreateTable
CREATE TABLE "comercio" (
    "id" UUID NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "cuit" VARCHAR(13),
    "plan" "plan" NOT NULL DEFAULT 'FREE',
    "iva_default" DECIMAL(5,2) NOT NULL DEFAULT 21,
    "moneda" CHAR(3) NOT NULL DEFAULT 'ARS',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comercio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "firebase_uid" VARCHAR(128) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "nombre" VARCHAR(120),
    "rol" "rol" NOT NULL DEFAULT 'DUENIO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_firebase_uid_key" ON "usuario"("firebase_uid");

-- CreateIndex
CREATE INDEX "usuario_comercio_id_idx" ON "usuario"("comercio_id");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

