import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../app_de_prueba.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

/// Catálogo falso que respeta q y estado, como la API.
RespuestaFalsa catalogo(Map<String, dynamic> query, {bool conCosto = true}) {
  final todos = [
    productoJson(conCosto: conCosto),
    productoJson(id: idProducto2, codigo: 'AM-1L', nombre: 'Aceite mineral 1 L', stockActual: 1, estadoStock: 'BAJO', conCosto: conCosto),
    productoJson(id: 'p3', codigo: 'BT-12', nombre: 'Batería 12V', stockActual: 0, estadoStock: 'SIN_STOCK', conCosto: conCosto),
  ];
  final q = (query['q'] as String? ?? '').toLowerCase();
  final estado = query['estado'] as String?;
  final items = todos.where((p) {
    final coincide = q.isEmpty || (p['nombre'] as String).toLowerCase().contains(q) || (p['codigo'] as String).toLowerCase().contains(q);
    return coincide && (estado == null || p['estadoStock'] == estado);
  }).toList();
  return RespuestaFalsa.ok({'items': items, 'siguienteCursor': null});
}

Future<void> irAlInventario(WidgetTester tester, ServidorFalso servidor, {String rol = 'DUENIO'}) async {
  await levantar(tester, servidor, auth: authConSesion());
  if (rol != 'EMPLEADO') await tocar(tester, 'Inventario');
}

void main() {
  testWidgets('CP-M.3 búsqueda y chips filtran contra la API', (tester) async {
    final servidor = servidorBase()..manejar('GET', '/products', (req) => catalogo(req.queryParameters));
    await irAlInventario(tester, servidor);

    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.text('Batería 12V'), findsOneWidget);
    expect(find.textContaining('FA-220 · Stock 10 · OK'), findsOneWidget);

    await tester.enterText(find.byType(TextField).first, 'ace');
    await tester.pump(const Duration(milliseconds: 350));
    await bombear(tester);
    expect(find.text('Batería 12V'), findsNothing);
    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.text('Aceite mineral 1 L'), findsOneWidget);

    await tocar(tester, 'Bajo');
    expect(find.text('Filtro de aceite'), findsNothing);
    expect(find.text('Aceite mineral 1 L'), findsOneWidget);
    final ultimo = servidor.pedidosA('GET', '/products').last.queryParameters;
    expect(ultimo['q'], 'ace');
    expect(ultimo['estado'], 'BAJO');
  });

  testWidgets('CP-M.3b la segunda página se suma sin repetir', (tester) async {
    final servidor = servidorBase()
      ..manejar('GET', '/products', (req) {
        if (req.queryParameters['cursor'] == 'c2') {
          return RespuestaFalsa.ok({
            'items': [productoJson(id: 'p3', codigo: 'BT-12', nombre: 'Batería 12V')],
            'siguienteCursor': null,
          });
        }
        return RespuestaFalsa.ok({
          'items': [productoJson(), productoJson(id: idProducto2, codigo: 'AM-1L', nombre: 'Aceite mineral 1 L')],
          'siguienteCursor': 'c2',
        });
      });
    await irAlInventario(tester, servidor);
    await bombear(tester);

    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.text('Aceite mineral 1 L'), findsOneWidget);
    expect(find.text('Batería 12V'), findsOneWidget);
    expect(find.text('3 productos'), findsOneWidget);
    expect(servidor.pedidosA('GET', '/products').where((p) => p.queryParameters['cursor'] == 'c2').length, 1);
  });

  testWidgets('CP-M.3c / CP-M.3h EMPLEADO: sin costos y sin alta', (tester) async {
    final servidor = servidorBase(rol: 'EMPLEADO')..manejar('GET', '/products', (req) => catalogo(req.queryParameters, conCosto: false));
    await irAlInventario(tester, servidor, rol: 'EMPLEADO');

    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.textContaining(r'$ 3.990,00'), findsWidgets);
    expect(find.textContaining('costo'), findsNothing);
    expect(find.text('Nuevo producto'), findsNothing);
  });

  testWidgets('CP-M.3e alta rápida crea el producto y vuelve al inventario', (tester) async {
    final servidor = servidorBase()
      ..responder('POST', '/products', RespuestaFalsa.creado(productoJson(id: 'p9', codigo: 'X-1', nombre: 'Bujía')));
    await irAlInventario(tester, servidor);

    await tocar(tester, 'Nuevo producto');
    await escribir(tester, 'Código', 'X-1');
    await escribir(tester, 'Nombre', 'Bujía');
    await escribir(tester, 'Precio de venta (con IVA)', '3.990,50');
    await escribir(tester, 'Costo de reposición (sin IVA)', '2400');
    await escribir(tester, 'Stock inicial', '12');
    await escribir(tester, 'Stock de seguridad', '3');
    await tocar(tester, 'Guardar producto');

    final post = servidor.pedidosA('POST', '/products').single;
    expect(jsonDecode(jsonEncode(post.data)), {
      'codigo': 'X-1',
      'nombre': 'Bujía',
      'precioVenta': '3990.50',
      'costoReposicion': '2400.00',
      'stockInicial': 12,
      'stockSeguridad': 3,
    });
    expect(find.text('Producto creado'), findsOneWidget);
    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(servidor.pedidosA('GET', '/products').length, greaterThanOrEqualTo(2));
  });

  testWidgets('CP-M.3f código repetido muestra el mensaje de la API', (tester) async {
    final servidor = servidorBase()
      ..responder(
        'POST',
        '/products',
        RespuestaFalsa.error(409, 'CONFLICTO', 'Ya existe un producto con el código FA-220.', details: {'codigo': 'Ya existe.'}),
      );
    await irAlInventario(tester, servidor);
    await tocar(tester, 'Nuevo producto');
    await escribir(tester, 'Código', 'FA-220');
    await escribir(tester, 'Nombre', 'Filtro');
    await escribir(tester, 'Precio de venta (con IVA)', '100');
    await escribir(tester, 'Costo de reposición (sin IVA)', '50');
    await tocar(tester, 'Guardar producto');

    expect(find.text('Ya existe un producto con el código FA-220.'), findsOneWidget);
    expect(find.text('Ya existe.'), findsOneWidget);
    expect(find.text('Nuevo producto'), findsOneWidget);
  });

  testWidgets('CP-M.3g límite del plan FREE', (tester) async {
    final servidor = servidorBase()
      ..responder('POST', '/products', RespuestaFalsa.error(402, 'PLAN_REQUERIDO', 'Llegaste al límite de 50 productos del plan FREE.'));
    await irAlInventario(tester, servidor);
    await tocar(tester, 'Nuevo producto');
    await escribir(tester, 'Código', 'X-51');
    await escribir(tester, 'Nombre', 'Uno más');
    await escribir(tester, 'Precio de venta (con IVA)', '100');
    await escribir(tester, 'Costo de reposición (sin IVA)', '50');
    await tocar(tester, 'Guardar producto');

    expect(find.text('Llegaste al límite de 50 productos del plan FREE.'), findsOneWidget);
  });

  testWidgets('la validación local frena el alta sin llamar a la API', (tester) async {
    final servidor = servidorBase();
    await irAlInventario(tester, servidor);
    await tocar(tester, 'Nuevo producto');
    await tocar(tester, 'Guardar producto');

    expect(find.text('El código es obligatorio.'), findsOneWidget);
    expect(find.text('Ingresá el precio de venta con IVA.'), findsOneWidget);
    expect(servidor.pedidosA('POST', '/products'), isEmpty);
  });
}
