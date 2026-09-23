# Runbook · Despliegue

## API en Render (plan Free)

1. En Render: **New → Blueprint**, elegir el repositorio `FrancoGaggero/inventariosmart`. Render lee `render.yaml` y crea el servicio `inventariosmart-api` (Docker, región Ohio).
2. En el servicio, pestaña **Environment**, cargar las variables marcadas `sync: false`:
   - `DATABASE_URL`: cadena _pooled_ de la rama `production` de Neon.
   - `DIRECT_URL`: cadena directa de la misma rama (la usa `prisma migrate deploy` al arrancar).
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: service account en base64 (`firebase-admin.env` de la carpeta de secretos).
   - `CORS_ORIGINS`: `https://<proyecto>.vercel.app,http://localhost:5173`.
   - `RESEND_API_KEY` (opcional, HU-06): API key de Resend para el correo de alertas de reposición; sin ella los envíos
     quedan en el log. `MAIL_FROM` (default `InventarioSmart <onboarding@resend.dev>`: sin dominio verificado sólo
     entrega a la casilla del dueño de la cuenta Resend) y `WEB_URL` (enlace de los correos).
3. **Manual Deploy → Deploy latest commit**. El primer build tarda unos minutos.
4. Verificar: `https://inventariosmart-api.onrender.com/api/v1/health` responde `{"status":"ok","db":"ok",…}` y `/docs` muestra Swagger.
5. Desde entonces cada push a `main` redespliega solo.

Limitación del plan Free: el servicio se suspende tras 15 minutos sin tráfico y la primera respuesta tarda entre 30 y 50 segundos. Para una demo, abrir `/api/v1/health` un minuto antes.

## Web en Vercel

1. En Vercel el proyecto ya está vinculado al repositorio. En **Settings → General**:
   - **Root Directory:** `apps/web`.
   - **Framework Preset:** Vite. Build command `pnpm build`, output `dist` (los detecta solo).
   - Activar **Include source files outside of the Root Directory** para que el workspace de pnpm resuelva `packages/*`.
2. **Settings → Environment Variables**: todas las de `apps/web/.env.example` con los valores reales. `VITE_API_URL` = URL de Render.
3. **Deployments → Redeploy**.
4. En Firebase: **Authentication → Settings → Dominios autorizados**, agregar el dominio de Vercel. Sin esto el login con Google falla con `auth/unauthorized-domain`.
5. En Render: agregar el dominio de Vercel a `CORS_ORIGINS` y redesplegar.
6. Verificar: abrir la web, iniciar sesión con Google y comprobar que la pantalla muestra el email devuelto por `GET /api/v1/me`.

## Previews de Vercel contra la rama `dev` de Neon

En Vercel, **Environment Variables → Preview**: `VITE_API_URL` puede apuntar al mismo servicio de Render (la API no tiene entorno de preview en el plan Free). La rama `dev` de Neon se usa desde la máquina local y desde CI.

## Cambiar el plan de un comercio (hasta HU-14)

Las alertas de reposición (HU-06) exigen plan PRO. Mientras no exista la gestión de planes (HU-14, Fase 3), el plan se
cambia por SQL con la propietaria de la base (`DIRECT_URL` de la carpeta de secretos), nunca con `app_api`:

```sql
UPDATE comercio SET plan = 'PRO' WHERE id = '<uuid del comercio>';
```

El `PlanGuard` lee el plan en cada request: el cambio aplica sin reiniciar la API.

## Rollback

- **Render:** Deployments → elegir el anterior → **Rollback**. Las migraciones son aditivas; no hace falta revertirlas.
- **Vercel:** Deployments → **Promote to Production** sobre el deployment anterior.

## Rotación de credenciales

- **Firebase service account:** Configuración del proyecto → Cuentas de servicio → Generar nueva clave; actualizar `FIREBASE_SERVICE_ACCOUNT_JSON` en Render y en la carpeta de secretos; borrar la clave vieja en Google Cloud IAM. Pendiente antes del hito H4 (la clave del sprint 0 pasó por un chat).
- **Neon:** Roles → Reset password; actualizar `DATABASE_URL` y `DIRECT_URL` en Render y en los `.env` locales.
