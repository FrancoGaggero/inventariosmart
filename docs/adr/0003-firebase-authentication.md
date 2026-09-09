# ADR 0003 · Autenticación delegada en Firebase Authentication

**Estado:** aceptada · 09/09/2026

## Contexto

RF-11 y RNF-03 exigen autenticación con OAuth 2.0, inicio de sesión con Google (preferencia relevada en la encuesta) y control de acceso por roles. La API no debe almacenar contraseñas.

## Decisión

Firebase Authentication emite la identidad (Google y email/contraseña) en web y en Android. La API verifica el ID token en cada request con `firebase-admin` (guard global; rutas públicas marcadas con `@Public()`). El comercio, el rol y el plan **no** viven en Firebase: se guardan en PostgreSQL y se resuelven en cada request, para que un cambio de rol aplique de inmediato.

La credencial del service account se inyecta por variable de entorno (`FIREBASE_SERVICE_ACCOUNT_JSON`, base64), nunca como archivo en el repositorio.

## Alternativas consideradas

- **Autenticación propia con JWT y bcrypt:** más código, más riesgo, sin login con Google gratis.
- **Supabase Auth:** válido, pero implicaría cambiar el stack comprometido en la Propuesta v2.0.
- **Custom claims de Firebase para roles:** los cambios tardan en propagarse hasta renovar el token; un rol revocado seguiría vigente hasta una hora.

## Consecuencias

- Los tests e2e reemplazan el verificador de tokens por un doble (`TokenVerifier`); `firebase-admin` se mapea a stubs en Jest porque depende de `jose` (sólo ESM).
- La clave privada usada durante el sprint 0 pasó por un chat y debe rotarse antes del hito H4.
