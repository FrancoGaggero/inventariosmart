-- AlterTable
ALTER TABLE "comercio" ADD COLUMN     "onboarding_pendiente" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "usuario" ALTER COLUMN "firebase_uid" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");


-- ---------------------------------------------------------------------------
-- Row Level Security (RNF-10). Ver docs/runbooks/rls.md.
-- La API fija `app.comercio_id` con set_config(..., true) en cada transacción.
-- `app.rol_sistema = 'provisioning'` habilita el alta del comercio y los jobs.
-- FORCE es imprescindible: la app se conecta como propietaria de las tablas.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_comercio_actual() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.comercio_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_es_sistema() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT current_setting('app.rol_sistema', true) = 'provisioning'
$$;

ALTER TABLE "comercio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "comercio" FORCE ROW LEVEL SECURITY;
CREATE POLICY comercio_tenant ON "comercio"
  USING (id = app_comercio_actual())
  WITH CHECK (id = app_comercio_actual());
CREATE POLICY comercio_sistema ON "comercio"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());

ALTER TABLE "usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuario" FORCE ROW LEVEL SECURITY;
CREATE POLICY usuario_tenant ON "usuario"
  USING (comercio_id = app_comercio_actual())
  WITH CHECK (comercio_id = app_comercio_actual());
CREATE POLICY usuario_sistema ON "usuario"
  USING (app_es_sistema())
  WITH CHECK (app_es_sistema());
