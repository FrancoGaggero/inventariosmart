import { createBrowserRouter } from 'react-router';
import { AuthGate } from '@/features/auth/AuthGate';
import { LoginPage } from '@/features/auth/LoginPage';
import { OnboardingPage } from '@/features/auth/OnboardingPage';
import { RegistroPage } from '@/features/auth/RegistroPage';
import { RequireRole } from '@/features/auth/RequireRole';
import { ComercioPage } from '@/features/config/ComercioPage';
import { UsuariosPage } from '@/features/config/UsuariosPage';
import { HomePage } from '@/features/home/HomePage';
import { AppShell } from './AppShell';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/registro', element: <RegistroPage /> },
  {
    element: <AuthGate />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <HomePage /> },
          {
            element: <RequireRole roles={['DUENIO']} />,
            children: [
              { path: '/configuracion/usuarios', element: <UsuariosPage /> },
              { path: '/configuracion/comercio', element: <ComercioPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
