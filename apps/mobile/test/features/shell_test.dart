import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../app_de_prueba.dart';

Iterable<String> etiquetasDeLaBarra(WidgetTester tester) {
  final barra = tester.widget<NavigationBar>(find.byType(NavigationBar));
  return barra.destinations.map((d) => (d as NavigationDestination).label);
}

void main() {
  testWidgets('DUENIO ve Inicio, Inventario y Movimiento', (tester) async {
    await levantar(tester, servidorBase(), auth: authConSesion());

    expect(etiquetasDeLaBarra(tester), ['Inicio', 'Inventario', 'Movimiento']);
    expect(enInicio(), findsOneWidget);

    await tocar(tester, 'Inventario');
    expect(find.text('Filtro de aceite'), findsOneWidget);
    await tocar(tester, 'Movimiento');
    expect(find.text('Registrar movimiento'), findsOneWidget);
  });

  testWidgets('CP-M.2e EMPLEADO no tiene panel: su inicio es el inventario', (tester) async {
    await levantar(tester, servidorBase(rol: 'EMPLEADO'), auth: authConSesion());

    expect(etiquetasDeLaBarra(tester), ['Inventario', 'Movimiento']);
    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(enInicio(), findsNothing);
  });

  testWidgets('CP-M.3d / CP-M.4g CONTADOR sólo ve el panel, sin pestañas', (tester) async {
    await levantar(tester, servidorBase(rol: 'CONTADOR'), auth: authConSesion());

    expect(find.byType(NavigationBar), findsNothing);
    expect(enInicio(), findsOneWidget);
    expect(find.text('Registrar movimiento'), findsNothing);
  });
}
