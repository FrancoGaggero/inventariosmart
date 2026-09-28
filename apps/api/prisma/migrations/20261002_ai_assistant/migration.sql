-- CreateEnum: quién escribió cada mensaje de una conversación con el asistente (HU-08).
CREATE TYPE "rol_mensaje" AS ENUM ('USUARIO', 'ASISTENTE');

-- CreateTable: una conversación de un usuario con el asistente (design D5).
CREATE TABLE "conversacion" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "titulo" VARCHAR(80) NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable: mensajes del usuario y del asistente, con las consultas que hizo y lo que dejó preparado.
CREATE TABLE "mensaje_asistente" (
    "id" UUID NOT NULL,
    "comercio_id" UUID NOT NULL,
    "conversacion_id" UUID NOT NULL,
    "rol" "rol_mensaje" NOT NULL,
    "contenido" TEXT NOT NULL,
    "fuentes" JSONB NOT NULL DEFAULT '[]',
    "acciones" JSONB NOT NULL DEFAULT '[]',
    "modelo" VARCHAR(80),
    "tokens_entrada" INTEGER,
    "tokens_salida" INTEGER,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensaje_asistente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversacion_comercio_id_usuario_id_actualizado_en_id_idx" ON "conversacion"("comercio_id", "usuario_id", "actualizado_en" DESC, "id" DESC);
CREATE INDEX "mensaje_asistente_comercio_id_conversacion_id_creado_en_id_idx" ON "mensaje_asistente"("comercio_id", "conversacion_id", "creado_en", "id");
-- Para contar los mensajes del día de un comercio (límite diario, design D6).
CREATE INDEX "mensaje_asistente_comercio_id_rol_creado_en_idx" ON "mensaje_asistente"("comercio_id", "rol", "creado_en");

-- AddForeignKey
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mensaje_asistente" ADD CONSTRAINT "mensaje_asistente_comercio_id_fkey" FOREIGN KEY ("comercio_id") REFERENCES "comercio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "mensaje_asistente" ADD CONSTRAINT "mensaje_asistente_conversacion_id_fkey" FOREIGN KEY ("conversacion_id") REFERENCES "conversacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Integridad que Prisma no modela.
ALTER TABLE "conversacion" ADD CONSTRAINT "conversacion_titulo_check" CHECK (length(btrim("titulo")) > 0);
ALTER TABLE "mensaje_asistente" ADD CONSTRAINT "mensaje_asistente_contenido_check" CHECK (length("contenido") > 0);
ALTER TABLE "mensaje_asistente" ADD CONSTRAINT "mensaje_asistente_tokens_check"
  CHECK (("tokens_entrada" IS NULL OR "tokens_entrada" >= 0) AND ("tokens_salida" IS NULL OR "tokens_salida" >= 0));

-- ---------------------------------------------------------------------------
-- Row Level Security (checklist de docs/runbooks/rls.md).
-- RLS aísla comercios; que cada usuario vea sólo sus conversaciones lo filtra el servicio.
-- ---------------------------------------------------------------------------
ALTER TABLE "conversacion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversacion" FORCE ROW LEVEL SECURITY;
CREATE POLICY conversacion_tenant ON "conversacion"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY conversacion_sistema ON "conversacion"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

ALTER TABLE "mensaje_asistente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mensaje_asistente" FORCE ROW LEVEL SECURITY;
CREATE POLICY mensaje_asistente_tenant ON "mensaje_asistente"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY mensaje_asistente_sistema ON "mensaje_asistente"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

-- La conversación se actualiza con cada mensaje (actualizado_en) y no se borra.
GRANT SELECT, INSERT, UPDATE ON "conversacion" TO app_api;
REVOKE DELETE ON "conversacion" FROM app_api;
-- Los mensajes son de sólo inserción.
GRANT SELECT, INSERT ON "mensaje_asistente" TO app_api;
REVOKE UPDATE, DELETE ON "mensaje_asistente" FROM app_api;
