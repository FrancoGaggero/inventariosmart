-- Rol de aplicación para los tests e2e en CI (misma configuración que Neon, ver docs/runbooks/rls.md).
-- Se ejecuta ANTES de las migraciones: las migraciones pueden otorgar permisos a app_api y los
-- privilegios por defecto cubren toda tabla o función que se cree después.
-- postgres (superusuario) aplica migraciones; app_api (NOBYPASSRLS) corre la API bajo test.
CREATE ROLE app_api LOGIN PASSWORD 'app_api' NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT USAGE ON SCHEMA public TO app_api;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_api;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_api;
