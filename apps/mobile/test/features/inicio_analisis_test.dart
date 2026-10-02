import 'package:flutter_test/flutter_test.dart';

import '../app_de_prueba.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

/// Panel PRO con los bloques de análisis que trae `GET /dashboard`.
ServidorFalso servidorConAnalisis({
  String ganancia = '4000.00',
  String capital = '21000.00',
  Map<String, dynamic>? reposicion,
}) =>
    servidorPro()
      ..responder(
        'GET',
        '/dashboard',
        RespuestaFalsa.ok(dashboardJson(
          reposicion: reposicion ?? reposicionJson(),
          quiebres: {'gananciaPerdida': ganancia, 'ventaPerdida': '10000.00', 'productosAfectados': 1},
          stockParado: {'capitalParado': capital, 'productos': 1},
        )),
      );

void main() {
  testWidgets('CP-M.11 tarjetas de pérdidas y plata parada que llevan a su pantalla', (tester) async {
    final servidor = servidorConAnalisis();
    await levantar(tester, servidor, auth: authConSesion());

    expect(find.text('Perdiste por falta de stock'), findsOneWidget);
    expect(find.text(r'$ 4.000'), findsOneWidget);
    expect(find.text('de ganancia en los últimos 30 días · 1 producto sin stock'), findsOneWidget);
    expect(find.text('Plata parada en stock'), findsOneWidget);
    expect(find.text(r'$ 21.000'), findsOneWidget);
    expect(find.text('en 1 producto sin ventas en 90 días'), findsOneWidget);

    await tocar(tester, 'Perdiste por falta de stock');
    expect(find.text('Falta de stock'), findsOneWidget);
    expect(servidor.pedidosA('GET', '/stockouts'), isNotEmpty);

    await tocar(tester, 'Inicio');
    await tocar(tester, 'Plata parada en stock');
    expect(find.text('Stock parado'), findsOneWidget);
    expect(servidor.pedidosA('GET', '/dead-stock'), isNotEmpty);
  });

  testWidgets('CP-M.11b con montos en cero no aparecen las tarjetas', (tester) async {
    await levantar(tester, servidorConAnalisis(ganancia: '0.00', capital: '0.00'), auth: authConSesion());

    expect(find.text('Perdiste por falta de stock'), findsNothing);
    expect(find.text('Plata parada en stock'), findsNothing);
  });

  testWidgets('CP-M.11c bloque "Reposición" con cobertura, cuánto pedir y "Ver alertas"', (tester) async {
    await levantar(tester, servidorConAnalisis(), auth: authConSesion());

    expect(find.text('Reposición'), findsOneWidget);
    expect(find.text('Repuesto 0'), findsOneWidget);
    expect(find.text('se agota hoy de stock · pedir 10'), findsOneWidget);
    expect(find.text('2 días de stock · pedir 11'), findsOneWidget);
    expect(find.text('4 días de stock · pedir 12'), findsOneWidget);
    expect(find.text('3 productos por reponer en total, 1 crítico.'), findsOneWidget);

    await tocar(tester, 'Ver alertas');
    expect(find.text('Alertas de reposición'), findsOneWidget);
    expect(find.text('Pedir 20'), findsOneWidget);
  });

  testWidgets('CP-M.11c sin productos por reponer lo dice', (tester) async {
    await levantar(tester, servidorConAnalisis(reposicion: reposicionJson(n: 0, criticas: 0)), auth: authConSesion());

    expect(find.text('Ningún producto se va a quedar sin stock antes de que llegue la reposición.'), findsOneWidget);
    expect(find.text('Ver alertas'), findsNothing);
  });

  testWidgets('CP-M.11d en FREE avisa que las alertas son del PRO, sin tarjetas de análisis', (tester) async {
    await levantar(tester, servidorBase(), auth: authConSesion());

    expect(find.textContaining('Alertas predictivas de reposición: disponibles en el plan PRO.'), findsOneWidget);
    expect(find.text('Perdiste por falta de stock'), findsNothing);
    expect(find.text('Plata parada en stock'), findsNothing);
    // Los grupos sin stock y stock bajo siguen como antes.
    expect(find.text('Sin stock: 2'), findsOneWidget);
  });
}
