import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/sesion.dart';
import '../core/modelos/me.dart';
import '../features/alertas/alertas_screen.dart';
import '../features/asistente/asistente_screen.dart';
import '../features/asistente/conversaciones_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/onboarding_screen.dart';
import '../features/inicio/inicio_screen.dart';
import '../features/inventario/inventario_screen.dart';
import '../features/inventario/producto_nuevo_screen.dart';
import '../features/mas/mas_screen.dart';
import '../features/movimientos/movimiento_screen.dart';
import '../features/ordenes/orden_screen.dart';
import '../features/ordenes/ordenes_screen.dart';
import '../features/quiebres/quiebres_screen.dart';
import '../features/stock_parado/stock_parado_screen.dart';
import 'cargando_screen.dart';
import 'shell.dart';

/// Rutas de la app (D4).
abstract final class Rutas {
  static const login = '/login';
  static const onboarding = '/onboarding';
  static const cargando = '/cargando';
  static const inicio = '/inicio';
  static const inventario = '/inventario';
  static const productoNuevo = '/inventario/nuevo';
  static const movimientoNuevo = '/movimientos/nuevo';
  static const mas = '/mas';
  static const alertas = '/mas/alertas';
  static const quiebres = '/mas/quiebres';
  static const stockParado = '/mas/stock-parado';
  static const asistente = '/mas/asistente';
  static const conversaciones = '/mas/asistente/conversaciones';
  static const ordenes = '/mas/ordenes';
}

/// Primera pestaña permitida para el rol.
String rutaInicialDe(Me me) => me.vePanel ? Rutas.inicio : Rutas.inventario;

/// true si la ruta está permitida para el rol (las pestañas ocultas no se alcanzan por URL).
bool rutaPermitida(Me me, String ruta) {
  // Alertas, falta de stock y stock parado: la API responde 403 al EMPLEADO (CP-M.8f). El plan lo
  // resuelve cada pantalla con su aviso (CP-M.10g).
  // El asistente es sólo del DUENIO: el CONTADOR ve "Análisis" pero no entra acá (CP-M.8g).
  if (ruta.startsWith(Rutas.asistente)) return me.usaAsistente;
  if (ruta.startsWith('${Rutas.mas}/')) return me.veAnalisis;
  if (ruta.startsWith(Rutas.inicio)) return me.vePanel;
  if (ruta.startsWith(Rutas.inventario)) return me.veInventario;
  if (ruta.startsWith(Rutas.movimientoNuevo)) return me.registraMovimientos;
  return true;
}

/// Decide a dónde mandar según sesión, /me y rol. null = quedarse.
String? decidirRedireccion({
  required AsyncValue<Object?> sesion,
  required AsyncValue<Me?> me,
  required String ruta,
}) {
  final enLogin = ruta == Rutas.login;
  if (sesion.isLoading && !sesion.hasValue) return ruta == Rutas.cargando ? null : Rutas.cargando;
  if (sesion.value == null) return enLogin ? null : Rutas.login;

  // Con sesión: hace falta /me para saber rol y onboarding.
  if (me.isLoading && !me.hasValue) return ruta == Rutas.cargando ? null : Rutas.cargando;
  if (me.hasError && !me.hasValue) return ruta == Rutas.cargando ? null : Rutas.cargando;
  final datos = me.value;
  if (datos == null) return enLogin ? null : Rutas.login;

  if (datos.onboardingPendiente && datos.esDuenio) {
    return ruta == Rutas.onboarding ? null : Rutas.onboarding;
  }
  final esPantallaDeEntrada = enLogin || ruta == Rutas.onboarding || ruta == Rutas.cargando;
  if (esPantallaDeEntrada || !rutaPermitida(datos, ruta)) return rutaInicialDe(datos);
  return null;
}

final routerProvider = Provider<GoRouter>((ref) {
  final refresco = ValueNotifier(0);
  ref.onDispose(refresco.dispose);
  ref.listen(sesionProvider, (_, _) => refresco.value += 1);
  ref.listen(meProvider, (_, _) => refresco.value += 1);

  return GoRouter(
    initialLocation: Rutas.cargando,
    refreshListenable: refresco,
    redirect: (context, state) => decidirRedireccion(
      sesion: ref.read(sesionProvider),
      me: ref.read(meProvider),
      ruta: state.matchedLocation,
    ),
    routes: [
      GoRoute(path: Rutas.login, builder: (_, _) => const LoginScreen()),
      GoRoute(path: Rutas.onboarding, builder: (_, _) => const OnboardingScreen()),
      GoRoute(path: Rutas.cargando, builder: (_, _) => const CargandoScreen()),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) => AppShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: Rutas.inicio, builder: (_, _) => const InicioScreen())]),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Rutas.inventario,
                builder: (_, state) => InventarioScreen(estadoInicial: state.uri.queryParameters['estado']),
                routes: [GoRoute(path: 'nuevo', builder: (_, _) => const ProductoNuevoScreen())],
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Rutas.movimientoNuevo,
                builder: (_, state) => MovimientoScreen(
                  productoId: state.uri.queryParameters['productoId'],
                  tipoInicial: state.uri.queryParameters['tipo'],
                ),
              ),
            ],
          ),
          StatefulShellBranch(
            routes: [
              GoRoute(
                path: Rutas.mas,
                builder: (_, _) => const MasScreen(),
                routes: [
                  GoRoute(path: 'alertas', builder: (_, _) => const AlertasScreen()),
                  GoRoute(path: 'quiebres', builder: (_, _) => const QuiebresScreen()),
                  GoRoute(path: 'stock-parado', builder: (_, _) => const StockParadoScreen()),
                  GoRoute(
                    path: 'ordenes',
                    builder: (_, _) => const OrdenesScreen(),
                    routes: [GoRoute(path: ':id', builder: (_, state) => OrdenScreen(id: state.pathParameters['id']!))],
                  ),
                  GoRoute(
                    path: 'asistente',
                    builder: (_, _) => const AsistenteScreen(),
                    routes: [GoRoute(path: 'conversaciones', builder: (_, _) => const ConversacionesScreen())],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
