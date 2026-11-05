## Context

**Infraestructura actual:**
- La base de producción es la rama `production` de Neon, con PostgreSQL 18.
- Dos roles (`docs/runbooks/rls.md`):
  - `neondb_owner`: propietario de las tablas, miembro de `neon_superuser`, que tiene `BYPASSRLS`;
  - `app_api`: lo usa la API y tiene RLS (`NOBYPASSRLS`).
- La API corre en Render y la web en Vercel.
- El CI de GitHub Actions ya usa un servicio `postgres:18` para los e2e.

**Qué falta:**
- No hay respaldo propio.
- La restauración a un punto en el tiempo de Neon tiene, en el plan gratuito, una ventana muy corta frente a los 30 días que pide RNF-09.

La motivación está en proposal.md.

## Goals / Non-Goals

**Goals:**
- Un respaldo completo por día, cifrado, que se conserve 30 días y no cueste nada.
- Que cada respaldo se pruebe restaurándolo, no sólo generándolo.
- Un procedimiento de recuperación que cualquiera pueda seguir paso a paso, ensayado una vez.

**Non-Goals:**
- Recuperación con pérdida cero (RPO de minutos): el objetivo es un día.
- Restaurar por comercio.
- Replicación o alta disponibilidad.

## Decisions

### D1. `pg_dump` en GitHub Actions, con artefactos de 30 días

- **Disparo:** `respaldo.yml` corre con `schedule: cron: '0 6 * * *'` (03:00 de Buenos Aires) y con `workflow_dispatch`.
- **El volcado:**
  - se hace con la imagen oficial `postgres:18` (`docker run --rm postgres:18 pg_dump`), así la versión del cliente coincide con la del servidor de Neon;
  - el runner trae un cliente más viejo, y `pg_dump` se niega a volcar un servidor de versión mayor más nueva.
- **Opciones:**
  - `--format=custom --no-owner --no-privileges --dbname "$BACKUP_DATABASE_URL"`;
  - el formato custom permite `pg_restore` selectivo y en paralelo, y viene comprimido;
  - sin dueños ni privilegios, el archivo se restaura en cualquier rama: los permisos de `app_api` se recrean con el runbook de RLS.
- **Rol:**
  - el volcado usa la conexión directa (sin pooler) con `neondb_owner`;
  - `pg_dump` desactiva `row_security`, y con un rol sujeto a RLS falla o deja tablas vacías;
  - `app_api` no sirve para esto, y crear un rol con `BYPASSRLS` en Neon pide `neon_superuser`, que ya es lo que tiene el propietario.
- **Guardado:**
  - `actions/upload-artifact@v4` con `retention-days: 30`;
  - nombre `respaldo-AAAA-MM-DD`, con la fecha de Buenos Aires;
  - GitHub borra solo los vencidos.
- *Alternativas descartadas:*
  - **Bucket S3 o R2 con ciclo de vida:** otra cuenta y otras credenciales para el mismo resultado.
  - **Google Drive:** una credencial de servicio más y sin vencimiento automático.
  - **Commit en una rama:** el historial crecería con datos de clientes, aunque estén cifrados.
  - **PITR de Neon pago:** tiene costo y no deja un archivo propio.

### D2. Cifrado

- **Cómo:** `gpg --batch --symmetric --cipher-algo AES256 --passphrase-file` con el secreto `BACKUP_PASSPHRASE`.
- **Por qué hace falta:** el repositorio es público y sus artefactos los puede bajar cualquier usuario de GitHub con sesión. El volcado sin cifrar nunca se escribe al artefacto: `pg_dump` escribe a un archivo temporal del runner y gpg lo cifra antes de subirlo.
- **La frase:** vive en los secretos de GitHub y en la carpeta de secretos de Franco. Si se pierde, los respaldos no se pueden abrir: el runbook lo dice en el primer paso.
- **Nunca en un log:** `::add-mask::` para la conexión y para la frase.

### D3. Verificación de cada respaldo

El mismo workflow tiene un segundo paso contra un servicio `postgres:18` efímero del runner (igual que el CI):

1. **Restaurar:** descifra el artefacto recién generado y lo restaura con `pg_restore --no-owner --no-privileges --exit-on-error`.
2. **Devolver los permisos:** crear `app_api` y aplicar el SQL de `.github/scripts/permisos-app-api.sh`.
   - Con `--no-privileges` el volcado no lleva los `GRANT` ni los `REVOKE`, entre ellos los recortes de las tablas de sólo inserción (RN-07).
   - El script los rearma con el bloque general de `rls.md` más los de cada migración, en orden.
   - Es el mismo paso que el runbook: así se prueba a diario. *Agregado durante el apply:* el diseño original no lo preveía, y sin él una restauración dejaba a `app_api` con `UPDATE` y `DELETE` sobre el historial.
3. **Comprobar** con `psql` (`.github/scripts/verificar-respaldo.sh`):
   - que existan las 19 tablas del esquema;
   - que las filas de `_prisma_migrations` coincidan con las carpetas de `apps/api/prisma/migrations` del commit que corre, así se ve si producción tiene migraciones pendientes;
   - que haya al menos un comercio;
   - que la RLS esté activa y forzada en todas las tablas;
   - que `app_api` lea todas las tablas, no lea `_prisma_migrations` y no tenga ninguno de los privilegios que le revocan las migraciones.
4. **Registrar:** los tamaños y las cantidades por tabla van al resumen del workflow (`$GITHUB_STEP_SUMMARY`), sin datos personales.

Si cualquier paso falla, el workflow queda en rojo y GitHub avisa al dueño por correo. Con eso RNF-09 es verificable todos los días, no sólo una vez.

### D4. Runbook de recuperación (`docs/runbooks/restore.md`)

1. **Bajar** el respaldo con `gh run download <id> -n respaldo-AAAA-MM-DD`, o desde la pestaña Actions.
2. **Descifrar** con `gpg --decrypt` usando la frase de la carpeta de secretos.
3. **Preparar la rama:** crear en Neon una rama nueva, por ejemplo `restauracion-AAAA-MM-DD`, y dentro de ella una base vacía (`restaurada`), porque una rama hija copia los datos del padre. `app_api` viene heredado de `production`.
4. **Restaurar:** `pg_restore --no-owner --no-privileges --exit-on-error --dbname <conexión directa de esa base>` con el cliente de PostgreSQL 18 de la máquina, y después `permisos-app-api.sh` con `neondb_owner`.
5. **Verificar:** las mismas consultas del workflow, más entrar a la web contra esa rama en local.
6. **Cambiar:** apuntar `DATABASE_URL` y `DIRECT_URL` de Render a la rama restaurada, o promoverla a principal en Neon. También dice cómo volver atrás.

El ensayo se hace una vez, en una rama vacía, y la evidencia (fecha, cantidades y captura del resumen) queda en el runbook.

### D5. Documentos

- **ADR 0027:** D1 a D4 y las alternativas descartadas.
- **`docs/arquitectura.html`:** la nota de "Pendiente" de §8 pasa a describir lo construido, y §12 lo saca de pendientes.
- **Gantt:** la tarea 5.7 pasa a 100 %.
- **PL03:** sale de "Pendiente para la entrega".
- **`docs/runbooks/deploy.md`:** un enlace a `restore.md`.

## Risks / Trade-offs

| Riesgo | Mitigación |
|---|---|
| Se pierde la frase de cifrado y los respaldos quedan inutilizables | Está en dos lugares (GitHub y la carpeta de secretos). El runbook lo advierte arriba de todo. |
| La rama de Neon está suspendida (cómputo dormido) y el volcado tarda o falla | `pg_dump` despierta la rama al conectarse. El paso reintenta una vez y tiene un tiempo máximo de 15 minutos. |
| Los artefactos ocupan cuota de GitHub | El repo es público y los artefactos de repos públicos no consumen la cuota paga. Un volcado custom comprimido de esta base pesa unos pocos MB. |
| Producción tiene una migración que el repo no tiene, o al revés | La verificación compara `_prisma_migrations` con el repo y falla con el detalle. |
| El cron de GitHub se demora o no corre en repos inactivos (se desactiva tras 60 días sin commits) | El runbook dice cómo correrlo a mano y cómo reactivarlo. Antes de la entrega del 18/12 hay actividad. |
| Credenciales en logs | Se enmascaran y nunca se hace `echo`. La conexión se pasa por variable de entorno. |

## Migration Plan

**Deploy:**
1. Franco crea los dos secretos en GitHub (Settings → Secrets and variables → Actions).
2. Se mergea el workflow.
3. Se corre una vez a mano con `workflow_dispatch` y se revisa el resumen.

**Rollback:** borrar o desactivar el workflow. No toca la base, ni la API ni la web.
