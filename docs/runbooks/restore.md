# Runbook · Recuperar la base desde un respaldo

RNF-09, ADR 0027. Todos los días a las 03:00 (hora de Buenos Aires), el workflow
[`respaldo.yml`](../../.github/workflows/respaldo.yml):

1. vuelca la rama `production` de Neon;
2. cifra el volcado con GPG (AES-256);
3. lo guarda 30 días como artefacto `respaldo-AAAA-MM-DD`;
4. lo restaura en una base efímera para comprobarlo.

Si el workflow termina en rojo, GitHub avisa por correo al dueño del repositorio.

> **Sin la frase no hay respaldo.** La frase de cifrado vive en dos lugares: el secreto
> `BACKUP_PASSPHRASE` de GitHub y `C:\Users\gagge\secrets\inventariosmart\backup-passphrase.txt`.
> GitHub no deja leer un secreto ya guardado, así que si se pierde el archivo local, ningún
> respaldo se puede abrir. Si alguna vez cambia la frase, los respaldos anteriores siguen
> necesitando la vieja.

Los comandos son para **Git Bash** en la máquina de desarrollo. Ya tiene `gpg`, `gh` y los clientes de
PostgreSQL 18 (`C:\Program Files\PostgreSQL\18\bin`), y se corren desde la raíz del repositorio. El
volcado descifrado tiene datos de clientes: **nunca va dentro del repositorio** y se borra al terminar
(paso 7).

## 1. Elegir y bajar el respaldo

```bash
gh run list --workflow respaldo.yml --limit 10        # corridas recientes, con su id y su estado
mkdir -p /c/Users/gagge/secrets/inventariosmart/respaldos
gh run download <id> -n respaldo-AAAA-MM-DD -D /c/Users/gagge/secrets/inventariosmart/respaldos
```

Elegí la corrida verde más reciente anterior al problema. También se puede bajar desde
**Actions → Respaldo diario → (corrida) → Artifacts**: es un .zip con el `.dump.gpg` adentro.

## 2. Descifrar

```bash
cd /c/Users/gagge/secrets/inventariosmart/respaldos
gpg --batch --pinentry-mode loopback --passphrase-file ../backup-passphrase.txt \
  --decrypt --output respaldo.dump respaldo-AAAA-MM-DD.dump.gpg
cd -
```

Si dice `decryption failed: Bad session key`, la frase no es la de ese respaldo.

## 3. Preparar una rama nueva en Neon

La rama `production` no se toca: si hay que volver atrás, sigue ahí.

1. En la consola de Neon: **Branches → Create branch**, nombre `restauracion-AAAA-MM-DD` y padre
   `production`. Una rama hija copia los datos del padre, así que el respaldo no se restaura sobre
   su base `neondb`: se restaura en una base nueva y vacía.
2. En esa rama, entrá a **Databases → New database**, con nombre `restaurada` y propietario `neondb_owner`.
3. En **Roles**, comprobá que esté `app_api`: la rama lo hereda de `production`, con la misma clave. Si
   no está, crealo con el `CREATE ROLE` de [rls.md](rls.md).
4. **Connect**, con rama `restauracion-AAAA-MM-DD`, base `restaurada` y rol `neondb_owner`, y
   **Connection pooling destildado**. Copiá la cadena y cargala sin que quede en el historial:

```bash
read -rs DESTINO && export DESTINO   # pegar la cadena y Enter (no se ve)
```

## 4. Restaurar y devolver los permisos

```bash
pg_restore --no-owner --no-privileges --exit-on-error \
  --dbname "$DESTINO" /c/Users/gagge/secrets/inventariosmart/respaldos/respaldo.dump

bash .github/scripts/permisos-app-api.sh apps/api/prisma/migrations neondb_owner \
  | psql "$DESTINO" -X -q -v ON_ERROR_STOP=1
```

El respaldo no lleva dueños ni permisos (`--no-owner --no-privileges`). Las tablas quedan a nombre de
`neondb_owner`, y [`permisos-app-api.sh`](../../.github/scripts/permisos-app-api.sh) rearma los permisos
de `app_api`: el bloque general de [rls.md](rls.md) y los recortes de cada migración, como las tablas
de sólo inserción de RN-07.

Las políticas de RLS sí viajan en el respaldo. Si `pg_restore` corta con un error, la base `restaurada`
quedó a medias: borrala desde **Databases**, creala de nuevo y repetí este paso.

## 5. Verificar

```bash
RESTAURADA_URL="$DESTINO" bash .github/scripts/verificar-respaldo.sh \
  apps/api/prisma/schema.prisma apps/api/prisma/migrations
```

**Qué comprueba:** son las mismas comprobaciones del workflow, más los permisos de `app_api`, que acá se
verifican sobre Neon:

- las 19 tablas;
- las migraciones contra el repositorio;
- que haya al menos un comercio;
- la RLS forzada en todas las tablas.

Imprime una tabla con cantidades y tamaños y termina con
"el respaldo se restauró y pasó todas las comprobaciones".

**Si marca migraciones del repositorio que el respaldo no tiene,** el respaldo es anterior a ellas. No es
un error: la API las aplica sola al arrancar (`prisma migrate deploy` en `start:prod`). Al revés, una
migración aplicada que el repositorio no tiene sí es un problema: revisá qué commit está desplegado
antes de seguir.

**Prueba con la web local, antes de tocar producción:**

1. Guardá una copia de `apps/api/.env` (por ejemplo `apps/api/.env.antes-de-restaurar`, ignorada por git).
2. En `apps/api/.env`, cambiá:
   - `DIRECT_URL`: la cadena del paso 3;
   - `DATABASE_URL`: la misma, con `app_api:<clave>` en lugar de `neondb_owner:<clave>` y el host
     `-pooler` (en **Connect**, con pooling tildado).
3. **Vaciá `RESEND_API_KEY` y `ANTHROPIC_API_KEY`.** La base es una copia de producción, y los jobs
   de alertas y de reportes semanales mandarían correos a clientes reales.
4. Levantá la API y la web:
   - `pnpm --filter @inventariosmart/api dev`;
   - `pnpm --filter @inventariosmart/web dev`.
5. Entrá con un usuario del comercio y revisá que estén los productos, el stock y los movimientos.
6. Volvé a poner el `.env` original.

## 6. Pasar producción a la base restaurada

1. **Anotá los valores actuales** de `DATABASE_URL` y `DIRECT_URL`: son la vuelta atrás. En Render están
   en **inventariosmart-api → Environment**, y los mismos valores tienen que estar en la carpeta de secretos.
2. **Cambiá las dos variables:**
   - `DIRECT_URL`: la cadena directa de la base `restaurada` con `neondb_owner` (paso 3);
   - `DATABASE_URL`: la cadena _pooled_ de la base `restaurada` con `app_api`.
3. **Save Changes**. Render redespliega solo, y al arrancar aplica las migraciones que falten.
4. **Comprobá** que `https://inventariosmart-api.onrender.com/api/v1/health` responda `"db":"ok"` y que la web
   funcione con un usuario real.
5. **Guardá las cadenas nuevas** en la carpeta de secretos.

**Vuelta atrás:** volvé a cargar en Render los dos valores anotados en el punto 1 y guardá. La rama
`production` quedó como estaba, porque la restauración nunca la modificó.

Si después querés que la base restaurada sea la principal, en Neon se marca su rama como **default**.
Las cadenas de conexión no cambian por eso.

## 7. Limpiar

```bash
rm -f /c/Users/gagge/secrets/inventariosmart/respaldos/respaldo.dump
unset DESTINO
```

Los `.dump.gpg` pueden quedar, porque están cifrados. Si la restauración fue sólo un ensayo, borrá la
rama `restauracion-AAAA-MM-DD` en Neon.

## Si el respaldo no corrió

- **A mano:** en **Actions → Respaldo diario → Run workflow**, o con `gh workflow run respaldo.yml`.
- **Si el cron se desactivó:** GitHub lo apaga después de 60 días sin actividad en el repositorio. Se
  reactiva con `gh workflow enable respaldo.yml`, o desde la misma página del workflow.
- **Si falta un secreto** (`BACKUP_DATABASE_URL` o `BACKUP_PASSPHRASE`), el primer paso falla con ese
  mensaje. Se cargan en **Settings → Secrets and variables → Actions**:
  - `BACKUP_DATABASE_URL`: la cadena directa de `production` con `neondb_owner`;
  - `BACKUP_PASSPHRASE`: la frase del archivo local.

## Ensayo de recuperación

Hecho una vez, sobre una rama vacía y con el respaldo de la primera corrida en producción (tarea 2.2 de
`database-backups`).

| Dato                                        | Valor       |
| ------------------------------------------- | ----------- |
| Fecha del ensayo                            | (pendiente) |
| Respaldo usado                              | (pendiente) |
| Tablas, migraciones y comercios verificados | (pendiente) |
| Web local contra la rama restaurada         | (pendiente) |
| Tiempo total                                | (pendiente) |
