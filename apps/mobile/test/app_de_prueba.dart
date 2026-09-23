import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/core/auth/auth_repository.dart';
import 'package:inventariosmart_mobile/main.dart';

import 'auth_falso.dart';
import 'dio_falso.dart';
import 'fixtures.dart';

/// La app completa (router incluido) sobre el servidor falso y sin reintentos automáticos.
Widget appDePrueba(ServidorFalso servidor, {AuthRepository? auth}) => ProviderScope(
      overrides: overridesDe(servidor, auth: auth),
      retry: (_, _) => null,
      child: const InventarioSmartApp(),
    );

/// Servidor con las rutas mínimas para entrar: /me, /dashboard y /products.
ServidorFalso servidorBase({String rol = 'DUENIO', bool onboardingPendiente = false, String plan = 'FREE'}) =>
    ServidorFalso()
      ..responder('GET', '/me', RespuestaFalsa.ok(meJson(rol: rol, onboardingPendiente: onboardingPendiente, plan: plan)))
      ..responder('GET', '/dashboard', RespuestaFalsa.ok(dashboardJson()))
      ..responder(
        'GET',
        '/products',
        RespuestaFalsa.ok({
          'items': [productoJson(), productoJson(id: idProducto2, codigo: 'AM-1L', nombre: 'Aceite mineral 1 L', stockActual: 1, estadoStock: 'BAJO')],
          'siguienteCursor': null,
        }),
      );

AuthRepositoryFalso authConSesion() => AuthRepositoryFalso(inicial: AuthRepositoryFalso.usuaria);

/// Levanta la app en una pantalla alta (800×2000 lógicos) para que las listas entren completas.
Future<void> levantar(WidgetTester tester, ServidorFalso servidor, {AuthRepository? auth}) async {
  tester.view.physicalSize = const Size(800, 2000);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(appDePrueba(servidor, auth: auth));
  await bombear(tester);
}

/// El inicio (panel) está en pantalla: el selector de mes es exclusivo de esa pantalla.
Finder enInicio() => find.byTooltip('Mes anterior');

/// Avanza el tiempo en pasos cortos: los indicadores de carga animan sin fin y `pumpAndSettle` no vuelve.
Future<void> bombear(WidgetTester tester, {int veces = 8}) async {
  for (var i = 0; i < veces; i++) {
    await tester.pump(const Duration(milliseconds: 120));
  }
}

/// Campo de texto por su etiqueta.
Finder campo(String etiqueta) =>
    find.byWidgetPredicate((w) => w is TextField && w.decoration?.labelText == etiqueta, description: 'TextField "$etiqueta"');

Future<void> escribir(WidgetTester tester, String etiqueta, String texto) async {
  await tester.enterText(campo(etiqueta), texto);
  await tester.pump();
}

Future<void> tocar(WidgetTester tester, String texto) async {
  await tester.ensureVisible(find.text(texto).first);
  await tester.tap(find.text(texto).first);
  await bombear(tester);
}
