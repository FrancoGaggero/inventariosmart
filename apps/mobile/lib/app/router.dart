import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/sesion.dart';
import '../core/modelos/me.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/onboarding_screen.dart';
import '../features/inicio/inicio_screen.dart';
import '../features/inventario/inventario_screen.dart';
import '../features/inventario/producto_nuevo_screen.dart';
import '../features/movimientos/movimiento_screen.dart';
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
}

/// Primera pestaña permitida para el rol.
String rutaInicialDe(Me me) => me.vePanel ? Rutas.inicio : Rutas.inventario;

/// true si la ruta está permitida para el rol (las pestañas ocultas no se alcanzan por URL).
bool rutaPermitida(Me me, String ruta) {
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
                builder: (_, state) => MovimientoScreen(productoId: state.uri.queryParameters['productoId']),
              ),
            ],
          ),
        ],
      ),
    ],
  );
});
