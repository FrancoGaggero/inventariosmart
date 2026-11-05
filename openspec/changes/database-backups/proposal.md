## Why

RNF-09 pide un respaldo automático diario de la base de datos, con retención mínima de 30 días y un procedimiento de recuperación documentado y verificable. Es el único requisito comprometido que todavía no está construido: `docs/arquitectura.html` (§8) y el PL03 lo marcan como pendiente. Hoy la única protección es la restauración a un punto en el tiempo de Neon, y en el plan gratuito su ventana es mucho menor a 30 días.

Es infraestructura: no cambia la API, la web ni la app, ni las reglas de negocio. Por eso se declara `skip_specs: true`. Corresponde a la Etapa 5 del Gantt (tarea 5.7).

## What Changes

- **Workflow nuevo `.github/workflows/respaldo.yml`**, que corre todos los días a las 03:00 de Buenos Aires y también a pedido:
  - hace un `pg_dump` de la rama `production` de Neon en formato custom, con la misma versión mayor de PostgreSQL (18);
  - lo cifra con GPG simétrico (AES-256) antes de que salga del runner;
  - lo guarda como artefacto del workflow con 30 días de retención.
- **Verificación automática de cada respaldo, en el mismo workflow:**
  - descifra el archivo;
  - lo restaura en un PostgreSQL 18 efímero del runner;
  - comprueba que estén las 19 tablas, que las migraciones de Prisma coincidan con las del repositorio y que la cantidad de comercios sea mayor a cero.
  - Si algo falla, el workflow falla y GitHub avisa por correo al dueño del repositorio.
- **Runbook `docs/runbooks/restore.md`:** cómo bajar un respaldo, descifrarlo, restaurarlo en una rama nueva de Neon, verificarlo y apuntar la API a esa rama. Se ensaya una vez en una rama vacía y se deja la evidencia.
- **ADR 0027:** respaldo con `pg_dump` cifrado en GitHub Actions.

### Fuera de alcance

- Respaldos en almacenamiento externo (S3, Google Drive, etc.): los artefactos de GitHub alcanzan para 30 días sin sumar otra cuenta ni credenciales.
- Restaurar sólo un comercio o un rango de fechas.
- Respaldo de Firebase Authentication: las cuentas se recrean y los datos de negocio están en PostgreSQL.
- Monitoreo con alertas fuera de los avisos de GitHub.

## Capabilities

### New Capabilities

Ninguna (`skip_specs: true`).

### Modified Capabilities

Ninguna.

## Impact

- **CI:** un workflow nuevo, `respaldo.yml`. El CI actual no cambia.
- **Secretos de GitHub que crea Franco** (nunca en el repositorio):
  - `BACKUP_DATABASE_URL`: la conexión directa (sin pooler) de la rama `production` con el rol propietario. `pg_dump` necesita leer todas las filas, y el rol de la API tiene RLS.
  - `BACKUP_PASSPHRASE`: la frase de cifrado, que también se guarda en la carpeta de secretos.
- **Docs:**
  - `docs/runbooks/restore.md` (nuevo) y `docs/runbooks/deploy.md`;
  - ADR 0027;
  - `docs/arquitectura.html` (§8 y §12);
  - `openspec/CAPACIDADES.md`;
  - el Gantt (tarea 5.7) y el PL03.
- **Sin cambios:** API, web, app móvil y contrato OpenAPI.
