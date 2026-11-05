# ADR 0027 · Respaldo diario con pg_dump cifrado en GitHub Actions

**Estado:** aceptada · 05/11/2026. RNF-09. Change `database-backups`.

## Contexto

RNF-09 pide tres cosas:

- un respaldo automático diario de la base;
- que se conserve por lo menos 30 días;
- un procedimiento de recuperación documentado y verificable.

Hasta ahora la única protección era la restauración a un punto en el tiempo de Neon, cuya ventana en el plan
gratuito no llega a los 30 días. Además, no deja un archivo propio fuera del proveedor.

Las condiciones de partida:

- la base es la rama `production` de Neon, con PostgreSQL 18;
- las tablas tienen RLS forzada (ADR 0002), y sólo `neondb_owner`, miembro de `neon_superuser`, la ignora;
- el repositorio es público;
- el presupuesto para infraestructura es cero.

## Decisión

1. **Workflow `.github/workflows/respaldo.yml`**, con cron `0 6 * * *` (03:00 de Buenos Aires) y `workflow_dispatch`.
2. **`pg_dump --format=custom --no-owner --no-privileges`** desde la imagen `postgres:18`:
   - el cliente del runner es más viejo que el servidor, y `pg_dump` no vuelca una versión mayor más nueva;
   - el volcado usa la conexión directa con `neondb_owner`, porque con un rol sujeto a RLS `pg_dump` falla o
     deja tablas vacías;
   - tiene un reintento, porque Neon puede tener el cómputo dormido.
3. **Cifrado GPG simétrico AES-256** con la frase del secreto `BACKUP_PASSPHRASE`, antes de que el archivo salga del
   runner. Es necesario porque los artefactos de un repositorio público los baja cualquier usuario con sesión en
   GitHub. La conexión y la frase sólo viven en variables de entorno, y la clave de la conexión se enmascara
   aparte del secreto completo.
4. **Artefacto `respaldo-AAAA-MM-DD`** con `retention-days: 30`. GitHub borra solo los vencidos.
5. **Cada respaldo se prueba restaurándolo.** En el mismo workflow:
   - se descifra el archivo recién guardado;
   - se restaura con `pg_restore --exit-on-error` en un `postgres:18` efímero;
   - se le devuelven sus permisos a `app_api`;
   - corre [`verificar-respaldo.sh`](../../.github/scripts/verificar-respaldo.sh).

   El script comprueba:

   - **tablas:** las 19 de `schema.prisma`;
   - **migraciones:** `_prisma_migrations` contra las carpetas del repositorio, en las dos direcciones;
   - **datos:** al menos un comercio;
   - **RLS:** activa y forzada en todas las tablas;
   - **permisos:** que `app_api` tenga lo que le dan las migraciones y no lo que le revocan.

   El resumen de la corrida lleva cantidades y tamaños, nunca filas. Si algo falla, el workflow queda en rojo y
   GitHub avisa por correo.

6. **Los permisos se rearman desde el repositorio.** Como el volcado no lleva privilegios, [`permisos-app-api.sh`](../../.github/scripts/permisos-app-api.sh)
   genera el SQL juntando dos fuentes:
   - el bloque general de [rls.md](../runbooks/rls.md);
   - los `GRANT` y `REVOKE` de cada migración, en orden, entre ellos los de las tablas de sólo inserción de RN-07.

   Lo usan el workflow y el runbook, así que una migración nueva con permisos propios queda cubierta sin tocar
   nada.

7. **Recuperación:** [`docs/runbooks/restore.md`](../runbooks/restore.md) cubre todo el recorrido:
   1. bajar el respaldo y descifrarlo;
   2. restaurarlo en una base vacía de una rama nueva de Neon;
   3. verificarlo con el mismo script;
   4. probarlo con la web local;
   5. apuntar Render a la base restaurada, con vuelta atrás.

   La rama `production` nunca se modifica.

## Alternativas consideradas

- **Bucket S3, R2 o B2 con regla de ciclo de vida:** otra cuenta y otras credenciales para el mismo resultado.
  §8 de la arquitectura lo preveía; los artefactos alcanzan para 30 días.
- **Google Drive:** una cuenta de servicio más y sin vencimiento automático.
- **Commit en una rama del repositorio:** el historial crecería para siempre con datos de clientes, aunque estén cifrados.
- **PITR pago de Neon:** tiene costo y no deja un archivo fuera del proveedor.
- **Volcado con privilegios:** arrastraría `ALTER DEFAULT PRIVILEGES` y concesiones de roles de Neon (`neondb_owner`,
  `neon_superuser`) que no existen en la base de prueba, y `pg_restore --exit-on-error` fallaría.
- **Cliente de PostgreSQL del runner:** es de una versión mayor anterior a la del servidor.

## Consecuencias

- **Costo:** ninguno. Los artefactos de un repositorio público no consumen cuota paga. El formato custom viene
  comprimido, y el peso de cada respaldo queda en el resumen de su corrida.
- **RPO de un día:** se pueden perder hasta 24 horas de datos. Alcanza para RNF-09; para algo menor haría falta
  PITR.
- **La frase de cifrado es crítica.** Vive en el secreto de GitHub, que no se puede volver a leer, y en la carpeta
  de secretos de Franco. Si se pierden las dos, los respaldos no sirven. El runbook lo advierte en el primer
  párrafo.
- **Rotar la clave de `neondb_owner`** obliga a actualizar `BACKUP_DATABASE_URL` (`deploy.md`, rotación de credenciales).
- **GitHub apaga los cron** de un repositorio sin actividad durante 60 días. El runbook explica cómo reactivarlo.
- **Las migraciones pendientes se detectan solas:** si producción no aplicó una migración del repositorio, o al
  revés, el respaldo de esa noche falla con el detalle.
- **Sin dependencias nuevas:** todo usa la imagen oficial `postgres:18`, `gpg` del runner y `actions/upload-artifact`.
