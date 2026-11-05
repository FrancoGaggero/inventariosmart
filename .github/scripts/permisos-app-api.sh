#!/usr/bin/env bash
# Imprime el SQL que devuelve sus permisos a app_api en una base restaurada (RNF-09, ADR 0027).
# El respaldo se hace con --no-privileges, así que los GRANT y REVOKE no viajan en el archivo: se
# rearman con el bloque general de docs/runbooks/rls.md más los de cada migración, en orden.
#
#   permisos-app-api.sh <carpeta de migraciones> <rol propietario> | psql "$URL" -v ON_ERROR_STOP=1
#
# El rol app_api tiene que existir antes (en Neon viene con la rama; ver docs/runbooks/restore.md).
set -euo pipefail

migraciones="${1:?falta la carpeta de migraciones}"
propietaria="${2:?falta el rol propietario (neondb_owner en Neon)}"

cat <<SQL
GRANT USAGE ON SCHEMA public TO app_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_api;
REVOKE ALL ON TABLE _prisma_migrations FROM app_api;
ALTER DEFAULT PRIVILEGES FOR ROLE $propietaria IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_api;
ALTER DEFAULT PRIVILEGES FOR ROLE $propietaria IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO app_api;
SQL

# Los recortes de cada migración (tablas de sólo inserción, historial que no se borra).
for archivo in "$migraciones"/*/migration.sql; do
  grep -E '^(GRANT|REVOKE) ' "$archivo" | tr -d '\r' || true
done
