import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import '../app_de_prueba.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

/// Entra a "Más" y abre las alertas.
Future<void> abrirAlertas(WidgetTester tester, ServidorFalso servidor) async {
  await levantar(tester, servidor, auth: authConSesion());
  await tocar(tester, 'Más');
  await tocar(tester, 'Alertas de reposición');
}

void main() {
  testWidgets('CP-M.9 alertas activas con su frase y sus datos', (tester) async {
    final servidor = servidorPro();
    await abrirAlertas(tester, servidor);

    expect(find.text('1 producto va a quedarse sin stock antes de que llegue la reposición. Uno ya está por debajo del punto de reposición.'),
        findsOneWidget);
    expect(find.text('Activas · 1'), findsOneWidget);
    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.text('Crítica'), findsOneWidget);
    expect(find.text('Stock 3 · mín. 2'), findsOneWidget);
    expect(find.text('Vende 2 por día · cobertura 2 días'), findsOneWidget);
    expect(find.text('Distribuidora Sur · lead time 5 d'), findsOneWidget);
    expect(find.text('Pedir 20'), findsOneWidget);
    expect(servidor.pedidosA('GET', '/alerts').single.uri.queryParameters['estado'], 'ACTIVA');
  });

  testWidgets('el filtro Pospuestas consulta ese estado y muestra hasta cuándo', (tester) async {
    final servidor = servidorPro()
      ..manejar('GET', '/alerts', (req) {
        final pospuestas = req.uri.queryParameters['estado'] == 'POSPUESTA';
        return RespuestaFalsa.ok({
          'items': [
            pospuestas
                ? alertaJson(estado: 'POSPUESTA', severidad: 'PROXIMA', pospuestaHasta: '2026-10-09T15:00:00.000Z', conProveedor: false)
                : alertaJson(),
          ],
          'siguienteCursor': null,
        });
      });
    await abrirAlertas(tester, servidor);
    await tocar(tester, 'Pospuestas');

    expect(servidor.pedidosA('GET', '/alerts').last.uri.queryParameters['estado'], 'POSPUESTA');
    expect(find.text('Próxima al quiebre'), findsOneWidget);
    expect(find.text('Pospuesta hasta 09/10/2026'), findsOneWidget);
    expect(find.text('Sin proveedor · lead time 5 d por defecto'), findsOneWidget);
    // Pospuesta: se puede atender, no volver a posponer.
    expect(find.text('Atendida'), findsOneWidget);
    expect(find.text('Posponer 7 días'), findsNothing);
  });

  testWidgets('CP-M.9b atender y posponer mandan la acción y sacan la alerta de las activas', (tester) async {
    final cerradas = <String>{};
    final servidor = servidorPro()
      ..manejar('GET', '/alerts', (_) => RespuestaFalsa.ok({
            'items': [
              for (final a in [alertaJson(), alertaJson(id: idAlerta2, nombre: 'Lámpara H4', codigo: 'LM-H4', productoId: idProducto2)])
                if (!cerradas.contains(a['id'])) a,
            ],
            'siguienteCursor': null,
          }));
    for (final id in [idAlerta, idAlerta2]) {
      servidor.manejar('PATCH', '/alerts/$id', (_) {
        cerradas.add(id);
        return RespuestaFalsa.ok(alertaJson(id: id, estado: 'ATENDIDA'));
      });
    }
    await abrirAlertas(tester, servidor);

    await tocar(tester, 'Atendida');
    final atender = servidor.pedidosA('PATCH', '/alerts/$idAlerta').single;
    expect(jsonDecode(jsonEncode(atender.data)), {'accion': 'ATENDER'});
    expect(find.textContaining('Filtro de aceite: alerta atendida.'), findsOneWidget);
    expect(find.text('Filtro de aceite'), findsNothing);

    await tocar(tester, 'Posponer 7 días');
    final posponer = servidor.pedidosA('PATCH', '/alerts/$idAlerta2').single;
    expect(jsonDecode(jsonEncode(posponer.data)), {'accion': 'POSPONER'});
    expect(find.text('Lámpara H4: alerta pospuesta 7 días.'), findsOneWidget);
    expect(find.text('No hay productos por reponer.'), findsOneWidget);
    // El resumen y el panel se vuelven a pedir.
    expect(servidor.pedidosA('GET', '/alerts/summary').length, greaterThanOrEqualTo(3));
  });

  testWidgets('CP-M.9c "Registrar ingreso" abre Movimiento con Ingreso y el producto elegidos', (tester) async {
    final servidor = servidorPro()..responder('GET', '/products/$idProducto', RespuestaFalsa.ok(productoJson()));
    await abrirAlertas(tester, servidor);
    await tocar(tester, 'Registrar ingreso');

    expect(find.text('Registrar movimiento'), findsOneWidget);
    expect(find.text('FA-220 · Filtro de aceite'), findsOneWidget);
    expect(find.text('Registrar ingreso'), findsOneWidget);
  });

  testWidgets('CP-M.9d el contador ve las alertas sin acciones', (tester) async {
    await abrirAlertas(tester, servidorPro(rol: 'CONTADOR'));

    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.text('Atendida'), findsNothing);
    expect(find.text('Posponer 7 días'), findsNothing);
    expect(find.text('Registrar ingreso'), findsNothing);
  });

  testWidgets('CP-M.9e sin alertas activas lo dice y explica el cálculo', (tester) async {
    final servidor = servidorPro()
      ..responder('GET', '/alerts', RespuestaFalsa.ok({'items': [], 'siguienteCursor': null}))
      ..responder('GET', '/alerts/summary', RespuestaFalsa.ok(resumenAlertasJson(activas: 0, criticas: 0)));
    await abrirAlertas(tester, servidor);

    expect(find.text('Ningún producto se va a quedar sin stock antes de que llegue la reposición.'), findsOneWidget);
    expect(find.text('No hay productos por reponer.'), findsOneWidget);
    expect(find.textContaining('ventas de los últimos 30 días y el lead time del proveedor principal'), findsOneWidget);
  });

  testWidgets('CP-M.9f en FREE explica el plan y no consulta las alertas', (tester) async {
    final servidor = servidorPro(plan: 'FREE');
    await abrirAlertas(tester, servidor);

    expect(find.textContaining('Disponibles en el plan PRO.'), findsOneWidget);
    expect(find.textContaining('Podés cambiar de plan desde la web'), findsOneWidget);
    expect(servidor.pedidosA('GET', '/alerts'), isEmpty);
    expect(servidor.pedidosA('GET', '/alerts/summary'), isEmpty);
  });

  testWidgets('CP-M.9g si la alerta ya estaba cerrada, muestra el mensaje de la API y recarga', (tester) async {
    final servidor = servidorPro()
      ..responder('PATCH', '/alerts/$idAlerta', RespuestaFalsa.error(409, 'CONFLICTO', 'La alerta ya está resuelta.'));
    await abrirAlertas(tester, servidor);
    final antes = servidor.pedidosA('GET', '/alerts').length;
    await tocar(tester, 'Atendida');

    expect(find.text('La alerta ya está resuelta.'), findsOneWidget);
    expect(servidor.pedidosA('GET', '/alerts').length, antes + 1);
  });

  testWidgets('"Cargar más" pide la página siguiente con el cursor', (tester) async {
    final servidor = servidorPro()
      ..manejar('GET', '/alerts', (req) => req.uri.queryParameters['cursor'] == 'c1'
          ? RespuestaFalsa.ok({
              'items': [alertaJson(id: idAlerta2, nombre: 'Lámpara H4', codigo: 'LM-H4')],
              'siguienteCursor': null,
            })
          : RespuestaFalsa.ok({'items': [alertaJson()], 'siguienteCursor': 'c1'}));
    await abrirAlertas(tester, servidor);
    await tocar(tester, 'Cargar más');

    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(find.text('Lámpara H4'), findsOneWidget);
    expect(find.text('Cargar más'), findsNothing);
  });
}
