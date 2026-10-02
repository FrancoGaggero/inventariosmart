import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/app/theme.dart';
import 'package:inventariosmart_mobile/core/modelos/me.dart';
import 'package:inventariosmart_mobile/features/mas/secciones.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../app_de_prueba.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

/// Brillo del tema que está aplicando la app.
Brightness brilloAplicado(WidgetTester tester) =>
    Theme.of(tester.element(find.byType(Scaffold).first)).brightness;

void main() {
  testWidgets('CP-M.8c la cuenta muestra comercio, email, rol y plan', (tester) async {
    await levantar(tester, servidorBase(plan: 'PRO'), auth: authConSesion());
    await tocar(tester, 'Más');

    expect(find.text('Repuestos Carlos'), findsOneWidget);
    expect(find.text('ana@ejemplo.com'), findsOneWidget);
    expect(find.text('Dueño'), findsOneWidget);
    expect(find.text('Pro'), findsOneWidget);
  });

  testWidgets('CP-M.8d aclara qué se hace desde la web y con qué dirección', (tester) async {
    await levantar(tester, servidorBase(rol: 'EMPLEADO'), auth: authConSesion());
    await tocar(tester, 'Más');

    for (final t in tareasDeLaWeb) {
      expect(find.text(t), findsOneWidget);
    }
    expect(find.text(direccionWeb), findsOneWidget);
  });

  testWidgets('CP-M.8e la cuenta sale del /me de quien inició sesión', (tester) async {
    final servidor = ServidorFalso()
      ..responder('GET', '/me', RespuestaFalsa.ok(meJson(rol: 'CONTADOR', plan: 'PREMIUM', nombreComercio: 'Kiosco Ana')))
      ..responder('GET', '/dashboard', RespuestaFalsa.ok(dashboardJson()));
    await levantar(tester, servidor, auth: authConSesion());
    await tocar(tester, 'Más');

    expect(find.text('Kiosco Ana'), findsOneWidget);
    expect(find.text('Repuestos Carlos'), findsNothing);
    expect(find.text('Contador'), findsOneWidget);
    expect(find.text('Premium'), findsOneWidget);
    // Ninguna consulta lleva el comercio como parámetro: la identidad la da el token (CP-11.5).
    expect(servidor.pedidos.every((p) => !p.uri.toString().contains('comercio')), isTrue);
  });

  testWidgets('CP-M.7 sin elección guardada, el tema sigue al del sistema', (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.light;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    await levantar(tester, servidorBase(), auth: authConSesion());
    expect(brilloAplicado(tester), Brightness.light);
    expect(Theme.of(tester.element(find.byType(Scaffold).first)).scaffoldBackgroundColor, Tokens.claro.bg);

    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    await bombear(tester);
    expect(brilloAplicado(tester), Brightness.dark);
    expect(Theme.of(tester.element(find.byType(Scaffold).first)).scaffoldBackgroundColor, Tokens.oscuro.bg);
  });

  testWidgets('CP-M.7b elegir "Claro" lo guarda y se aplica aunque el sistema esté en oscuro', (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    SharedPreferences.setMockInitialValues({});
    final preferencias = await SharedPreferences.getInstance();

    await levantar(tester, servidorBase(), auth: authConSesion(), preferencias: preferencias);
    expect(brilloAplicado(tester), Brightness.dark);
    await tocar(tester, 'Más');
    await tocar(tester, 'Claro');

    expect(brilloAplicado(tester), Brightness.light);
    expect(preferencias.getString('tema'), 'claro');
  });

  testWidgets('CP-M.7b al reabrir la app, respeta el tema guardado', (tester) async {
    tester.platformDispatcher.platformBrightnessTestValue = Brightness.dark;
    addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
    SharedPreferences.setMockInitialValues({'tema': 'claro'});
    final preferencias = await SharedPreferences.getInstance();

    await levantar(tester, servidorBase(), auth: authConSesion(), preferencias: preferencias);
    expect(brilloAplicado(tester), Brightness.light);

    await tocar(tester, 'Más');
    await tocar(tester, 'Sistema');
    expect(brilloAplicado(tester), Brightness.dark);
    expect(preferencias.getString('tema'), 'sistema');
  });

  test('las secciones de "Más" nunca vienen vacías', () {
    for (final rol in roles) {
      final me = Me.fromJson(meJson(rol: rol, plan: 'PREMIUM'));
      expect(seccionesMas(me).where((s) => s.entradas.isEmpty), isEmpty);
    }
  });
}
