import { createBrowserRouter } from 'react-router';
import { AuthGate } from '@/features/auth/AuthGate';
import { LoginPage } from '@/features/auth/LoginPage';
import { OnboardingPage } from '@/features/auth/OnboardingPage';
import { RegistroPage } from '@/features/auth/RegistroPage';
import { RequireRole } from '@/features/auth/RequireRole';
import { ComercioPage } from '@/features/config/ComercioPage';
import { UsuariosPage } from '@/features/config/UsuariosPage';
import { HomePage } from '@/features/home/HomePage';
import { MovimientoFormPage } from '@/features/movimientos/MovimientoFormPage';
import { MovimientosPage } from '@/features/movimientos/MovimientosPage';
import { ProductoFormPage } from '@/features/productos/ProductoFormPage';
import { ProductosPage } from '@/features/productos/ProductosPage';
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
          { path: '/movimientos', element: <MovimientosPage /> },
          {
            element: <RequireRole roles={['DUENIO', 'EMPLEADO']} />,
            children: [
              { path: '/productos', element: <ProductosPage /> },
              { path: '/movimientos/nuevo', element: <MovimientoFormPage /> },
            ],
          },
          {
            element: <RequireRole roles={['DUENIO']} />,
            children: [
              { path: '/productos/nuevo', element: <ProductoFormPage /> },
              { path: '/productos/:id', element: <ProductoFormPage /> },
              { path: '/configuracion/usuarios', element: <UsuariosPage /> },
              { path: '/configuracion/comercio', element: <ComercioPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
