import { type ReactNode, Suspense, lazy } from 'react';

// Las pantallas públicas se cargan aparte (landing-motion D1): Motion viaja en su chunk y no en
// el paquete de la app con sesión. scripts/verificar-chunks.mjs lo controla después del build.

export const LandingPublica = lazy(() =>
  import('@/features/landing/LandingPage').then((m) => ({ default: m.LandingPage })),
);
export const LoginPublico = lazy(() =>
  import('@/features/auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
export const RegistroPublico = lazy(() =>
  import('@/features/auth/RegistroPage').then((m) => ({ default: m.RegistroPage })),
);

/** Mientras baja el chunk queda el fondo del tema, sin texto que parpadee. */
export function CargaPublica({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="min-h-full" aria-busy="true" />}>{children}</Suspense>;
}
