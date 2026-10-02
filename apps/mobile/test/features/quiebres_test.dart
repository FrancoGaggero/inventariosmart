import 'package:flutter_test/flutter_test.dart';

import '../app_de_prueba.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

Future<void> abrir(WidgetTester tester, ServidorFalso servidor, String entrada) async {
  await levantar(tester, servidor, auth: authConSesion());
  await tocar(tester, 'Más');
  await tocar(tester, entrada);
}

void main() {
  group('falta de stock', () {
    testWidgets('CP-M.10 pérdidas del período como estimación', (tester) async {
      final servidor = servidorPro();
      await abrir(tester, servidor, 'Falta de stock');

      expect(
        find.text('En los últimos 30 días 1 producto se quedó sin stock (1 sigue así): dejaste de ganar unos \$\u00a04.000.'),
        findsOneWidget,
      );
      expect(find.text('Ganancia perdida'), findsOneWidget);
      expect(find.text(r'$ 4.000'), findsNWidgets(2));
      expect(find.text('Ventas perdidas'), findsOneWidget);
      expect(find.text(r'$ 10.000'), findsOneWidget);
      expect(find.text('1 sigue sin stock'), findsOneWidget);
      expect(find.text('Batería 12V 65Ah'), findsOneWidget);
      expect(find.text('Sin stock: 5,0 días'), findsOneWidget);
      expect(find.text('Vendía 2,0 por día · 10,0 unidades'), findsOneWidget);
      expect(find.text('Sin stock ahora'), findsOneWidget);
      expect(find.textContaining('Estimamos lo que habrías vendido'), findsOneWidget);
      expect(servidor.pedidosA('GET', '/stockouts').single.uri.queryParameters['dias'], '30');
    });

    testWidgets('CP-M.10b cambiar a 90 días consulta ese período', (tester) async {
      final servidor = servidorPro()
        ..manejar('GET', '/stockouts', (req) => RespuestaFalsa.ok(quiebresJson(dias: int.parse(req.uri.queryParameters['dias']!))));
      await abrir(tester, servidor, 'Falta de stock');
      await tocar(tester, '90 días');

      expect(servidor.pedidosA('GET', '/stockouts').last.uri.queryParameters['dias'], '90');
      expect(find.textContaining('En los últimos 90 días'), findsOneWidget);
    });

    testWidgets('CP-M.10c un producto sin historial no tiene cifra', (tester) async {
      final servidor = servidorPro()
        ..responder('GET', '/stockouts', RespuestaFalsa.ok(quiebresJson(items: [productoConQuiebresJson(sinHistorial: true, enCurso: false, quiebres: 2)])));
      await abrir(tester, servidor, 'Falta de stock');

      expect(find.text('Sin historial suficiente'), findsOneWidget);
      expect(find.text('D-4000 · 2 veces'), findsOneWidget);
      expect(find.textContaining('Vendía'), findsNothing);
      expect(find.text('Sin stock ahora'), findsNothing);
    });

    testWidgets('CP-M.10f sin quiebres en el período', (tester) async {
      final servidor = servidorPro()
        ..responder(
          'GET',
          '/stockouts',
          RespuestaFalsa.ok(quiebresJson(items: [], gananciaPerdida: '0.00', productosAfectados: 0, enCurso: 0)),
        );
      await abrir(tester, servidor, 'Falta de stock');

      expect(find.text('No te quedaste sin stock en este período.'), findsOneWidget);
      expect(find.text('En los últimos 30 días ningún producto se quedó sin stock.'), findsOneWidget);
    });

    testWidgets('"Cargar más" suma la página siguiente y conserva los totales', (tester) async {
      final servidor = servidorPro()
        ..manejar('GET', '/stockouts', (req) => req.uri.queryParameters['cursor'] == 'c1'
            ? RespuestaFalsa.ok(quiebresJson(items: [productoConQuiebresJson(id: 'otro', nombre: 'Filtro de aire', codigo: 'FA-1')]))
            : RespuestaFalsa.ok(quiebresJson(siguienteCursor: 'c1')));
      await abrir(tester, servidor, 'Falta de stock');
      await tocar(tester, 'Cargar más');

      expect(find.text('Batería 12V 65Ah'), findsOneWidget);
      expect(find.text('Filtro de aire'), findsOneWidget);
      expect(servidor.pedidosA('GET', '/stockouts').last.uri.queryParameters['dias'], '30');
    });
  });

  group('stock parado', () {
    testWidgets('CP-M.10d plata parada con la última venta y las ideas', (tester) async {
      final servidor = servidorPro();
      await abrir(tester, servidor, 'Stock parado');

      expect(
        find.text('Tenés \$\u00a021.000 (el 34 % de tu stock) en 1 producto que no se vendió en los últimos 90 días.'),
        findsOneWidget,
      );
      expect(find.text('Plata parada'), findsOneWidget);
      expect(find.text(r'$ 21.000'), findsNWidgets(2));
      expect(find.text('34,0 %'), findsOneWidget);
      expect(find.text('Kit de embrague'), findsOneWidget);
      expect(find.text(r'Stock 10 · costo $ 2.100,00'), findsOneWidget);
      expect(find.text('Última venta: 04/06/2026 · hace 120 días'), findsOneWidget);
      expect(find.textContaining('Para liberar esa plata'), findsOneWidget);
      expect(servidor.pedidosA('GET', '/dead-stock').single.uri.queryParameters['dias'], '90');
    });

    testWidgets('CP-M.10b cambiar a 180 días consulta ese período', (tester) async {
      final servidor = servidorPro()
        ..manejar('GET', '/dead-stock', (req) => RespuestaFalsa.ok(stockParadoJson(dias: int.parse(req.uri.queryParameters['dias']!))));
      await abrir(tester, servidor, 'Stock parado');
      await tocar(tester, '180 días');

      expect(servidor.pedidosA('GET', '/dead-stock').last.uri.queryParameters['dias'], '180');
      expect(find.textContaining('en los últimos 180 días'), findsOneWidget);
    });

    testWidgets('CP-M.10e un producto que nunca se vendió', (tester) async {
      final servidor = servidorPro()
        ..responder('GET', '/dead-stock', RespuestaFalsa.ok(stockParadoJson(items: [productoParadoJson(ultimaVenta: null, diasSinVender: 95)])));
      await abrir(tester, servidor, 'Stock parado');

      expect(find.text('Nunca se vendió · 95 días desde el alta'), findsOneWidget);
    });

    testWidgets('CP-M.10f sin stock parado en el período', (tester) async {
      final servidor = servidorPro()..responder('GET', '/dead-stock', RespuestaFalsa.ok(stockParadoJson(productos: 0)));
      await abrir(tester, servidor, 'Stock parado');

      expect(find.text('No tenés stock parado en este período.'), findsOneWidget);
      expect(find.text('Ningún producto con stock lleva más de 90 días sin venderse.'), findsOneWidget);
    });
  });

  testWidgets('CP-M.10g en FREE no aparecen en "Más" y la pantalla explica el plan sin consultar', (tester) async {
    final servidor = servidorPro(plan: 'FREE');
    await levantar(tester, servidor, auth: authConSesion());
    await tocar(tester, 'Más');
    expect(find.text('Alertas de reposición'), findsOneWidget);
    expect(find.text('Falta de stock'), findsNothing);
    expect(find.text('Stock parado'), findsNothing);

    await ir(tester, '/mas/quiebres');
    expect(find.textContaining('Disponible en el plan PRO: mirá cuánto dejaste de ganar'), findsOneWidget);
    await ir(tester, '/mas/stock-parado');
    expect(find.textContaining('Disponible en el plan PRO: mirá cuánta plata tenés parada'), findsOneWidget);
    expect(servidor.pedidosA('GET', '/stockouts'), isEmpty);
    expect(servidor.pedidosA('GET', '/dead-stock'), isEmpty);
  });

  testWidgets('un 402 de la API muestra su mensaje sin "Reintentar"', (tester) async {
    final servidor = servidorPro()
      ..responder('GET', '/stockouts',
          RespuestaFalsa.error(402, 'PLAN_REQUERIDO', 'Esta función está disponible a partir del plan PRO.', details: {'planMinimo': 'PRO'}));
    await abrir(tester, servidor, 'Falta de stock');

    expect(find.text('Esta función está disponible a partir del plan PRO.'), findsOneWidget);
    expect(find.text('Reintentar'), findsNothing);
  });

  testWidgets('CP-M.10h ningún pedido de análisis lleva el comercio', (tester) async {
    final servidor = servidorPro();
    await levantar(tester, servidor, auth: authConSesion());
    for (final ruta in ['/mas/alertas', '/mas/quiebres', '/mas/stock-parado']) {
      await ir(tester, ruta);
    }
    final analisis = servidor.pedidos.where((p) => ['/alerts', '/stockouts', '/dead-stock'].any(p.uri.path.contains));
    expect(analisis, isNotEmpty);
    for (final p in analisis) {
      expect(p.uri.toString().toLowerCase(), isNot(contains('comercio')));
    }
  });
}
