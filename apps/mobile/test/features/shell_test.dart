import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../app_de_prueba.dart';

Iterable<String> etiquetasDeLaBarra(WidgetTester tester) {
  final barra = tester.widget<NavigationBar>(find.byType(NavigationBar));
  return barra.destinations.map((d) => (d as NavigationDestination).label);
}

void main() {
  testWidgets('CP-M.8 DUENIO ve Inicio, Inventario, Movimiento y Más', (tester) async {
    await levantar(tester, servidorBase(), auth: authConSesion());

    expect(etiquetasDeLaBarra(tester), ['Inicio', 'Inventario', 'Movimiento', 'Más']);
    expect(enInicio(), findsOneWidget);

    await tocar(tester, 'Inventario');
    expect(find.text('Filtro de aceite'), findsOneWidget);
    await tocar(tester, 'Movimiento');
    expect(find.text('Registrar movimiento'), findsOneWidget);
    await tocar(tester, 'Más');
    expect(find.text('Cerrar sesión'), findsOneWidget);
  });

  testWidgets('CP-M.2e / CP-M.8b EMPLEADO no tiene panel: su inicio es el inventario', (tester) async {
    await levantar(tester, servidorBase(rol: 'EMPLEADO'), auth: authConSesion());

    expect(etiquetasDeLaBarra(tester), ['Inventario', 'Movimiento', 'Más']);
    expect(find.text('Filtro de aceite'), findsOneWidget);
    expect(enInicio(), findsNothing);
  });

  testWidgets('CP-M.3d / CP-M.4g / CP-M.8b CONTADOR ve el panel y Más, sin inventario ni movimientos', (tester) async {
    await levantar(tester, servidorBase(rol: 'CONTADOR'), auth: authConSesion());

    expect(etiquetasDeLaBarra(tester), ['Inicio', 'Más']);
    expect(enInicio(), findsOneWidget);
    expect(find.text('Registrar movimiento'), findsNothing);
  });
}
