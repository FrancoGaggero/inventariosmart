import { createBrowserRouter } from 'react-router';
import { AlertasPage } from '@/features/alertas/AlertasPage';
import { AuthGate } from '@/features/auth/AuthGate';
import { LoginPage } from '@/features/auth/LoginPage';
import { OnboardingPage } from '@/features/auth/OnboardingPage';
import { RegistroPage } from '@/features/auth/RegistroPage';
import { RequireRole } from '@/features/auth/RequireRole';
import { ComercioPage } from '@/features/config/ComercioPage';
import { GastoFormPage } from '@/features/gastos/GastoFormPage';
import { GastosPage } from '@/features/gastos/GastosPage';
import { UsuariosPage } from '@/features/config/UsuariosPage';
import { HomePage } from '@/features/home/HomePage';
import { ImportarProductosPage } from '@/features/importacion/ImportarProductosPage';
import { MovimientoFormPage } from '@/features/movimientos/MovimientoFormPage';
import { MovimientosPage } from '@/features/movimientos/MovimientosPage';
import { ProductoFormPage } from '@/features/productos/ProductoFormPage';
import { ProductosPage } from '@/features/productos/ProductosPage';
import { ImportarListaPage } from '@/features/proveedores/ImportarListaPage';
import { ProveedorDetallePage } from '@/features/proveedores/ProveedorDetallePage';
import { ProveedorFormPage } from '@/features/proveedores/ProveedorFormPage';
import { ProveedoresPage } from '@/features/proveedores/ProveedoresPage';
import { RentabilidadPage } from '@/features/rentabilidad/RentabilidadPage';
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
            element: <RequireRole roles={['DUENIO', 'CONTADOR']} />,
            children: [
              { path: '/gastos', element: <GastosPage /> },
              { path: '/rentabilidad', element: <RentabilidadPage /> },
              { path: '/alertas', element: <AlertasPage /> },
            ],
          },
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
              { path: '/importar', element: <ImportarProductosPage /> },
              { path: '/productos/:id', element: <ProductoFormPage /> },
              { path: '/proveedores', element: <ProveedoresPage /> },
              { path: '/proveedores/nuevo', element: <ProveedorFormPage /> },
              { path: '/proveedores/:id', element: <ProveedorDetallePage /> },
              { path: '/proveedores/:id/editar', element: <ProveedorFormPage /> },
              { path: '/proveedores/:id/importar', element: <ImportarListaPage /> },
              { path: '/gastos/nuevo', element: <GastoFormPage /> },
              { path: '/gastos/:id', element: <GastoFormPage /> },
              { path: '/configuracion/usuarios', element: <UsuariosPage /> },
              { path: '/configuracion/comercio', element: <ComercioPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
