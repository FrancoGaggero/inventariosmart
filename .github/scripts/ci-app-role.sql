-- Rol de aplicación para los tests e2e en CI (misma configuración que Neon, ver docs/runbooks/rls.md).
-- postgres (superusuario) aplica migraciones; app_api (NOBYPASSRLS) corre la API bajo test.
CREATE ROLE app_api LOGIN PASSWORD 'app_api' NOBYPASSRLS NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT USAGE ON SCHEMA public TO app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_api;
REVOKE ALL ON TABLE _prisma_migrations FROM app_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_api;
