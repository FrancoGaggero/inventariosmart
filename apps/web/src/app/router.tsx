import { createBrowserRouter } from 'react-router';
import { AlertasPage } from '@/features/alertas/AlertasPage';
import { AsistentePage } from '@/features/asistente/AsistentePage';
import { AuthGate } from '@/features/auth/AuthGate';
import { OnboardingPage } from '@/features/auth/OnboardingPage';
import { RequireRole } from '@/features/auth/RequireRole';
import { ComercioPage } from '@/features/config/ComercioPage';
import { PlanPage } from '@/features/config/PlanPage';
import { GastoFormPage } from '@/features/gastos/GastoFormPage';
import { GastosPage } from '@/features/gastos/GastosPage';
import { UsuariosPage } from '@/features/config/UsuariosPage';
import { HomePage } from '@/features/home/HomePage';
import { ImportarProductosPage } from '@/features/importacion/ImportarProductosPage';
import { InflacionPage } from '@/features/inflacion/InflacionPage';
import { MovimientoFormPage } from '@/features/movimientos/MovimientoFormPage';
import { MovimientosPage } from '@/features/movimientos/MovimientosPage';
import { OrdenPage } from '@/features/ordenes/OrdenPage';
import { OrdenesPage } from '@/features/ordenes/OrdenesPage';
import { SugerenciaPage } from '@/features/ordenes/SugerenciaPage';
import { ProductoFormPage } from '@/features/productos/ProductoFormPage';
import { ProductosPage } from '@/features/productos/ProductosPage';
import { ComparacionProductoPage } from '@/features/proveedores/ComparacionProductoPage';
import { ComparadorPage } from '@/features/proveedores/ComparadorPage';
import { ImportarListaPage } from '@/features/proveedores/ImportarListaPage';
import { ProveedorDetallePage } from '@/features/proveedores/ProveedorDetallePage';
import { ProveedorFormPage } from '@/features/proveedores/ProveedorFormPage';
import { ProveedoresPage } from '@/features/proveedores/ProveedoresPage';
import { RemarcacionesPage } from '@/features/remarcacion/RemarcacionesPage';
import { RemarcarPage } from '@/features/remarcacion/RemarcarPage';
import { RentabilidadPage } from '@/features/rentabilidad/RentabilidadPage';
import { ReportePage } from '@/features/reportes/ReportePage';
import { ReportesPage } from '@/features/reportes/ReportesPage';
import { QuiebresPage } from '@/features/quiebres/QuiebresPage';
import { StockParadoPage } from '@/features/stock-parado/StockParadoPage';
import { CargaPublica, LoginPublico, RegistroPublico } from '@/features/publico/carga';
import { AppShell } from './AppShell';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <CargaPublica>
        <LoginPublico />
      </CargaPublica>
    ),
  },
  {
    path: '/registro',
    element: (
      <CargaPublica>
        <RegistroPublico />
      </CargaPublica>
    ),
  },
  {
    element: <AuthGate />,
    children: [
      { path: '/onboarding', element: <OnboardingPage /> },
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <HomePage /> },
          { path: '/movimientos', element: <MovimientosPage /> },
          { path: '/configuracion/plan', element: <PlanPage /> },
          {
            element: <RequireRole roles={['DUENIO', 'CONTADOR']} />,
            children: [
              { path: '/gastos', element: <GastosPage /> },
              { path: '/rentabilidad', element: <RentabilidadPage /> },
              { path: '/alertas', element: <AlertasPage /> },
              { path: '/quiebres', element: <QuiebresPage /> },
              { path: '/stock-parado', element: <StockParadoPage /> },
              { path: '/ordenes', element: <OrdenesPage /> },
              { path: '/ordenes/nueva', element: <SugerenciaPage /> },
              { path: '/ordenes/:id', element: <OrdenPage /> },
              { path: '/reportes', element: <ReportesPage /> },
              { path: '/reportes/:id', element: <ReportePage /> },
              { path: '/inflacion', element: <InflacionPage /> },
              { path: '/remarcar', element: <RemarcarPage /> },
              { path: '/remarcaciones', element: <RemarcacionesPage /> },
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
              { path: '/proveedores/comparador', element: <ComparadorPage /> },
              {
                path: '/proveedores/comparador/:productoId',
                element: <ComparacionProductoPage />,
              },
              { path: '/proveedores/:id', element: <ProveedorDetallePage /> },
              { path: '/proveedores/:id/editar', element: <ProveedorFormPage /> },
              { path: '/proveedores/:id/importar', element: <ImportarListaPage /> },
              { path: '/gastos/nuevo', element: <GastoFormPage /> },
              { path: '/gastos/:id', element: <GastoFormPage /> },
              { path: '/asistente', element: <AsistentePage /> },
              { path: '/configuracion/usuarios', element: <UsuariosPage /> },
              { path: '/configuracion/comercio', element: <ComercioPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
