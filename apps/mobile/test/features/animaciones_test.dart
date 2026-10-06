import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../app_de_prueba.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

/// Assets de las imágenes en pantalla (ADR 0025).
Iterable<String> assetsEnPantalla(WidgetTester tester) => tester
    .widgetList<Image>(find.byType(Image))
    .map((i) => i.image)
    .whereType<AssetImage>()
    .map((a) => a.assetName);

void main() {
  // flutter_test simula un sistema en tema claro y la app sigue al sistema: se esperan las variantes claras.
  testWidgets('los estados vacíos usan su ilustración animada', (tester) async {
    final servidor = servidorPro(plan: 'PREMIUM')
      ..responder('GET', '/alerts', RespuestaFalsa.ok({'items': [], 'siguienteCursor': null}))
      ..responder('GET', '/alerts/summary', RespuestaFalsa.ok(resumenAlertasJson(activas: 0, criticas: 0)))
      ..responder('GET', '/stockouts', RespuestaFalsa.ok(quiebresJson(items: [], gananciaPerdida: '0.00', productosAfectados: 0, enCurso: 0)))
      ..responder('GET', '/dead-stock', RespuestaFalsa.ok(stockParadoJson(productos: 0)))
      ..responder('GET', '/assistant/conversations', RespuestaFalsa.ok(conversacionesJson(items: [])));
    await levantar(tester, servidor, auth: authConSesion());

    for (final (ruta, archivo) in [
      ('/mas/alertas', 'vacio-campana'),
      ('/mas/quiebres', 'vacio-cajas'),
      ('/mas/stock-parado', 'vacio-recibo'),
      ('/mas/asistente/conversaciones', 'vacio-flechas'),
    ]) {
      await ir(tester, ruta);
      expect(assetsEnPantalla(tester), contains('assets/animaciones/$archivo-claro.webp'), reason: ruta);
    }
  });

  testWidgets('el onboarding muestra la bienvenida animada', (tester) async {
    await levantar(tester, servidorBase(onboardingPendiente: true), auth: authConSesion());

    expect(find.text('PRIMER PASO'), findsOneWidget);
    expect(assetsEnPantalla(tester), contains('assets/animaciones/bienvenida-claro.webp'));
  });
}
