-- Después de las migraciones: la tabla de control de Prisma no es de la aplicación.
REVOKE ALL ON TABLE _prisma_migrations FROM app_api;
