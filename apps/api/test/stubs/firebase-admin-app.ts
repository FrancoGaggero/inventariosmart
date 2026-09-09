/**
 * Stub de `firebase-admin/app` para Jest.
 * firebase-admin 14 depende de `jose` (sólo ESM), que Jest no puede cargar en Node 22.
 * Los tests reemplazan TokenVerifier por un doble, así que el SDK real nunca se necesita.
 */
export type App = { name: string };
export type ServiceAccount = { projectId?: string; clientEmail?: string; privateKey?: string };

export const getApps = (): App[] => [];
export const getApp = (): App => ({ name: 'stub' });
export const initializeApp = (): App => ({ name: 'stub' });
export const cert = (cuenta: ServiceAccount): ServiceAccount => cuenta;
