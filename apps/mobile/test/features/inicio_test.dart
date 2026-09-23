import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/core/formato.dart';

import '../app_de_prueba.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

void main() {
  testWidgets('CP-M.2 panel con los cuatro indicadores, top 3 y alertas', (tester) async {
    await levantar(tester, servidorBase(), auth: authConSesion());

    expect(find.text(r'Este mes vendiste 45 unidades por $ 148.388,43 netos.'), findsOneWidget);
    expect(find.text('148 u.'), findsOneWidget);
    expect(find.textContaining(r'valorizado en $ 355.200,00'), findsOneWidget);
    expect(find.text(r'$ 148.388,43'), findsOneWidget);
    expect(find.textContaining('+200,0 % vs. Agosto 2026'), findsOneWidget);
    expect(find.text(r'$ 58.388,43'), findsOneWidget);
    expect(find.text('39,4 % sobre ventas netas'), findsOneWidget);
    expect(find.text(r'$ 52.500,00'), findsOneWidget);
    expect(find.textContaining('35,4 %'), findsOneWidget);
    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.text('Aceite mineral 1 L'), findsOneWidget);
    expect(find.text('Sin stock: 2'), findsOneWidget);
    expect(find.text('Stock bajo: 1'), findsOneWidget);
    expect(find.text('No calculable'), findsNothing);
  });

  testWidgets('CP-M.2b sin gastos: margen neto no calculable con guía a la web', (tester) async {
    final servidor = servidorBase()..responder('GET', '/dashboard', RespuestaFalsa.ok(dashboardJson(conGastos: false)));
    await levantar(tester, servidor, auth: authConSesion());

    expect(find.text('No calculable'), findsOneWidget);
    expect(find.text('Cargá tus gastos del mes desde la web'), findsOneWidget);
    expect(find.text('Faltan los gastos del mes: cargalos desde la web para ver el margen neto.'), findsOneWidget);
  });

  testWidgets('CP-M.2c cambiar de mes consulta ese período', (tester) async {
    final servidor = servidorBase();
    await levantar(tester, servidor, auth: authConSesion());

    final actual = mesActual();
    expect(find.text(etiquetaMes(actual)), findsOneWidget);
    expect(servidor.pedidosA('GET', '/dashboard').single.queryParameters['periodo'], actual);

    await tester.tap(find.byTooltip('Mes anterior'));
    await bombear(tester);

    final anterior = sumarMeses(actual, -1);
    expect(find.text(etiquetaMes(anterior)), findsOneWidget);
    expect(servidor.pedidosA('GET', '/dashboard').last.queryParameters['periodo'], anterior);
  });

  testWidgets('CP-M.2d una venta registrada refresca el panel al volver', (tester) async {
    var unidades = 45;
    final servidor = servidorBase()
      ..manejar('GET', '/dashboard', (_) {
        final d = dashboardJson();
        (d['ventas'] as Map<String, dynamic>)['unidadesVendidas'] = unidades;
        return RespuestaFalsa.ok(d);
      })
      ..responder('GET', '/products/$idProducto', RespuestaFalsa.ok(productoJson()))
      ..manejar('POST', '/movements', (_) {
        unidades = 47;
        return RespuestaFalsa.creado(movimientoJson());
      });
    await levantar(tester, servidor, auth: authConSesion());
    expect(find.textContaining('vendiste 45 unidades'), findsOneWidget);

    await tocar(tester, 'Inventario');
    await tocar(tester, 'Vender');
    await escribir(tester, 'Cantidad', '2');
    await tocar(tester, 'Registrar venta');
    expect(find.textContaining('Venta registrada'), findsOneWidget);

    await tocar(tester, 'Inicio');
    await bombear(tester);
    expect(find.textContaining('vendiste 47 unidades'), findsOneWidget);
  });

  testWidgets('CP-M.5 sin conexión: mensaje y reintentar', (tester) async {
    final servidor = servidorBase();
    await levantar(tester, servidor, auth: authConSesion());
    expect(enInicio(), findsOneWidget);

    servidor.sinRed = true;
    await tester.tap(find.byTooltip('Mes anterior'));
    await bombear(tester);
    expect(find.text('No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.'), findsOneWidget);

    servidor.sinRed = false;
    await tocar(tester, 'Reintentar');
    expect(enInicio(), findsOneWidget);
  });
}
