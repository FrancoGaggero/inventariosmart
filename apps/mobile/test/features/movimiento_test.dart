import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import '../app_de_prueba.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

ServidorFalso servidorConVenta({RespuestaFalsa? respuesta}) => servidorBase()
  ..responder('GET', '/products/$idProducto', RespuestaFalsa.ok(productoJson()))
  ..responder('POST', '/movements', respuesta ?? RespuestaFalsa.creado(movimientoJson()));

/// Entra como DUENIO, va al inventario y toca "Vender" en el primer producto (CP-M.4f).
Future<void> venderDesdeInventario(WidgetTester tester, ServidorFalso servidor) async {
  await levantar(tester, servidor, auth: authConSesion());
  await tocar(tester, 'Inventario');
  await tocar(tester, 'Vender');
}

String? claveDe(ServidorFalso servidor, int indice) =>
    servidor.pedidosA('POST', '/movements')[indice].headers['Idempotency-Key'] as String?;

void main() {
  testWidgets('CP-M.4 / CP-M.4f venta desde "Vender" con el producto precargado', (tester) async {
    final servidor = servidorConVenta();
    await venderDesdeInventario(tester, servidor);

    expect(find.text('Registrar movimiento'), findsOneWidget);
    expect(find.text('FA-220 · Filtro de aceite'), findsOneWidget);
    expect(find.textContaining(r'Precio de venta vigente: $ 3.990,00'), findsOneWidget);
    expect(find.text('Stock actual: 10'), findsOneWidget);

    await escribir(tester, 'Cantidad', '2');
    await tocar(tester, 'Registrar venta');

    final post = servidor.pedidosA('POST', '/movements').single;
    expect(jsonDecode(jsonEncode(post.data)), {'tipo': 'VENTA', 'productoId': idProducto, 'cantidad': 2});
    expect(claveDe(servidor, 0), isNotEmpty);
    expect(find.text('Venta registrada. Stock resultante: 8.'), findsOneWidget);
    expect(find.text('Registrar otro'), findsOneWidget);
    // Al volver, el inventario se vuelve a pedir (se invalidó al registrar).
    await tocar(tester, 'Ver inventario');
    expect(find.text('Registrar movimiento'), findsNothing);
    expect(servidor.pedidosA('GET', '/products').length, greaterThanOrEqualTo(2));
  });

  testWidgets('CP-M.4e aviso de stock bajo con el stock de seguridad', (tester) async {
    final servidor = servidorConVenta(respuesta: RespuestaFalsa.creado(movimientoJson(stockResultante: 4, estadoStock: 'BAJO')));
    await venderDesdeInventario(tester, servidor);
    await escribir(tester, 'Cantidad', '6');
    await tocar(tester, 'Registrar venta');

    expect(
      find.text('Venta registrada. Stock resultante: 4. Quedan 4 unidades, por debajo del stock de seguridad (5). Conviene reponer.'),
      findsOneWidget,
    );
  });

  testWidgets('CP-M.4c stock insuficiente muestra el mensaje de la API', (tester) async {
    final servidor = servidorConVenta(
      respuesta: RespuestaFalsa.error(409, 'CONFLICTO', 'Stock insuficiente: quedan 3 unidades.', details: {'cantidad': 'Máximo 3.'}),
    );
    await venderDesdeInventario(tester, servidor);
    await escribir(tester, 'Cantidad', '5');
    await tocar(tester, 'Registrar venta');

    expect(find.text('Stock insuficiente: quedan 3 unidades.'), findsOneWidget);
    expect(find.text('Máximo 3.'), findsOneWidget);
    expect(find.text('Reintentar'), findsOneWidget);
    expect(find.textContaining('Venta registrada'), findsNothing);
  });

  testWidgets('CP-M.4d el reintento repite la clave; editar el formulario la cambia', (tester) async {
    final servidor = servidorConVenta();
    await venderDesdeInventario(tester, servidor);
    await escribir(tester, 'Cantidad', '2');

    servidor.sinRed = true;
    await tocar(tester, 'Registrar venta');
    expect(find.text('No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.'), findsOneWidget);
    final clave1 = claveDe(servidor, 0);

    await tocar(tester, 'Reintentar');
    expect(claveDe(servidor, 1), clave1);

    await escribir(tester, 'Cantidad', '3');
    await tocar(tester, 'Registrar venta');
    final clave3 = claveDe(servidor, 2);
    expect(clave3, isNot(clave1));

    servidor.sinRed = false;
    await tocar(tester, 'Reintentar');
    expect(claveDe(servidor, 3), clave3);
    expect(find.text('Venta registrada. Stock resultante: 8.'), findsOneWidget);
  });

  testWidgets('CP-M.4b ingreso y ajuste piden motivo; el ajuste lo exige', (tester) async {
    final servidor = servidorConVenta(respuesta: RespuestaFalsa.creado(movimientoJson(tipo: 'AJUSTE', cantidad: -1, stockResultante: 9, motivo: 'ROTURA')));
    await levantar(tester, servidor, auth: authConSesion());
    await tocar(tester, 'Movimiento');

    // Elegir producto desde la hoja con buscador.
    await tocar(tester, 'Elegí un producto');
    await tocar(tester, 'Filtro de aceite');
    expect(find.text('FA-220 · Filtro de aceite'), findsOneWidget);

    await tocar(tester, 'Ingreso');
    expect(find.text('Motivo (opcional)'), findsOneWidget);

    await tocar(tester, 'Ajuste');
    expect(find.text('Motivo del ajuste'), findsOneWidget);
    await escribir(tester, 'Cantidad (negativa para restar)', '-1');
    await tocar(tester, 'Registrar ajuste');
    expect(find.text('Elegí el motivo del ajuste.'), findsOneWidget);
    expect(servidor.pedidosA('POST', '/movements'), isEmpty);

    await tocar(tester, 'Motivo del ajuste');
    await tocar(tester, 'Rotura o daño');
    await tocar(tester, 'Registrar ajuste');

    final post = servidor.pedidosA('POST', '/movements').single;
    expect(jsonDecode(jsonEncode(post.data)), {'tipo': 'AJUSTE', 'productoId': idProducto, 'cantidad': -1, 'motivo': 'ROTURA'});
    expect(find.text('Ajuste registrado. Stock resultante: 9.'), findsOneWidget);
  });
}
