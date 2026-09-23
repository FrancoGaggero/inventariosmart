import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';

import '../app_de_prueba.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

void main() {
  testWidgets('CP-M.1g onboarding pendiente pide el nombre y al guardar pasa al inicio', (tester) async {
    var pendiente = true;
    final servidor = servidorBase()
      ..manejar('GET', '/me', (_) => RespuestaFalsa.ok(meJson(onboardingPendiente: pendiente)))
      ..manejar('POST', '/me/onboarding', (req) {
        pendiente = false;
        return RespuestaFalsa.ok(meJson());
      });
    await levantar(tester, servidor, auth: authConSesion());

    expect(find.text('¿Cómo se llama tu comercio?'), findsOneWidget);
    expect(enInicio(), findsNothing);

    await escribir(tester, 'Nombre del comercio', 'Repuestos Carlos');
    await tocar(tester, 'Guardar y continuar');
    await bombear(tester);

    final post = servidor.pedidosA('POST', '/me/onboarding').single;
    expect(jsonDecode(jsonEncode(post.data)), {'nombreComercio': 'Repuestos Carlos'});
    expect(enInicio(), findsOneWidget);
  });

  testWidgets('el nombre corto se rechaza localmente', (tester) async {
    final servidor = servidorBase(onboardingPendiente: true);
    await levantar(tester, servidor, auth: authConSesion());

    await escribir(tester, 'Nombre del comercio', 'R');
    await tocar(tester, 'Guardar y continuar');

    expect(find.text('El nombre del comercio debe tener al menos 2 caracteres.'), findsOneWidget);
    expect(servidor.pedidosA('POST', '/me/onboarding'), isEmpty);
  });

  testWidgets('un EMPLEADO con onboarding pendiente no queda trabado: entra al inventario', (tester) async {
    final servidor = servidorBase(rol: 'EMPLEADO', onboardingPendiente: true);
    await levantar(tester, servidor, auth: authConSesion());

    expect(find.text('¿Cómo se llama tu comercio?'), findsNothing);
    expect(find.text('Inventario'), findsWidgets);
  });
}
