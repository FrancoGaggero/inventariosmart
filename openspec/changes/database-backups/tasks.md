## 1. Workflow de respaldo

- [ ] 1.1 `.github/workflows/respaldo.yml` con `schedule` (03:00 de Buenos Aires) y `workflow_dispatch`: `pg_dump` 18 en formato custom desde la imagen `postgres:18`, cifrado con GPG AES-256 y subido como artefacto `respaldo-AAAA-MM-DD` con `retention-days: 30`, enmascarando la conexión y la frase (D1, D2). Listo cuando: el workflow pasa `actionlint` (o la validación de sintaxis de GitHub) y en ningún paso aparece la conexión o la frase sin enmascarar
- [ ] 1.2 Verificación en el mismo workflow, con el servicio `postgres:18`: descifra, restaura con `pg_restore --exit-on-error`, comprueba las 19 tablas, las migraciones de `_prisma_migrations` contra `apps/api/prisma/migrations` y al menos un comercio, y escribe tamaños y cantidades en `$GITHUB_STEP_SUMMARY` sin datos personales (D3). Listo cuando: una prueba local con `act` o un volcado de la base de CI restaurado con los mismos comandos da todo en verde, y con una migración de más en el repositorio la comparación falla con el detalle
- [ ] 1.3 Franco crea los secretos `BACKUP_DATABASE_URL` (conexión directa de `production` con `neondb_owner`) y `BACKUP_PASSPHRASE`, y guarda la frase en la carpeta de secretos. Listo cuando: Franco lo confirma; Claude no maneja esas credenciales

## 2. Recuperación

- [ ] 2.1 `docs/runbooks/restore.md` con los pasos de D4 (bajar, descifrar, rama nueva de Neon, `pg_restore`, permisos de `app_api`, verificación, cambio de conexión en Render y vuelta atrás) y el enlace desde `docs/runbooks/deploy.md`. Listo cuando: el runbook se sigue de punta a punta sin pasos implícitos
- [ ] 2.2 Ensayo de recuperación: Franco crea una rama vacía de Neon y sigue el runbook con el respaldo de la primera corrida. Listo cuando: la rama restaurada pasa la verificación, la web local funciona contra ella y la evidencia (fecha, cantidades y captura) queda en el runbook

## 3. Documentación

- [ ] 3.1 ADR 0027 "Respaldo diario con pg_dump cifrado en GitHub Actions", nota en `docs/arquitectura.html` (§8 y §12), fila 34 en `openspec/CAPACIDADES.md`, tarea 5.7 al 100 % en el Gantt (`herramientas/diagramas/gantt.py`) y PL03 sin RNF-09 en pendientes. Listo cuando: los documentos describen lo construido y `python herramientas/diagramas/gantt.py` pasa la validación de dependencias

## 4. Cierre

- [ ] 4.1 `pnpm lint`, `pnpm format:check`, `pnpm typecheck` y `pnpm test`; push. Listo cuando: el CI del commit final está en verde
- [ ] 4.2 Primera corrida en producción con `workflow_dispatch`. Listo cuando: el workflow termina en verde, el artefacto existe con 30 días de retención y el resumen muestra las 19 tablas
- [ ] 4.3 Mover la tarjeta de Trello y actualizar el estado en el backlog. Listo cuando: Franco lo confirma
