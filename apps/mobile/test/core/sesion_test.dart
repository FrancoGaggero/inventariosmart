import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/core/auth/sesion.dart';

import '../auth_falso.dart';
import '../dio_falso.dart';
import '../fixtures.dart';

/// Riverpod 3 descarta un provider sin oyentes: hay que escucharlo antes de esperar su future.
Future<T> esperar<T>(ProviderContainer c, FutureProvider<T> p) {
  final sub = c.listen(p, (_, _) {});
  addTearDown(sub.close);
  return c.read(p.future);
}

void main() {
  test('sin sesión, meProvider devuelve null y no consulta la API', () async {
    final servidor = ServidorFalso();
    final auth = AuthRepositoryFalso();
    final container = contenedorDe(servidor, auth: auth);
    addTearDown(container.dispose);

    expect(await esperar(container, meProvider), isNull);
    expect(servidor.pedidos, isEmpty);
  });

  test('con sesión, meProvider consulta /me con el token', () async {
    final servidor = ServidorFalso()..responder('GET', '/me', RespuestaFalsa.ok(meJson()));
    final container = contenedorDe(servidor);
    addTearDown(container.dispose);

    final me = await esperar(container, meProvider);
    expect(me?.comercio.nombre, 'Repuestos Carlos');
    expect(servidor.pedidos.single.headers['Authorization'], 'Bearer token-uid-ana');
  });

  test('un 401 en /me cierra la sesión y deja el motivo (CP-M.1i)', () async {
    final servidor = ServidorFalso()
      ..responder('GET', '/me', RespuestaFalsa.error(401, 'NO_AUTENTICADO', 'Token inválido.'));
    final auth = AuthRepositoryFalso(inicial: AuthRepositoryFalso.usuaria);
    final container = contenedorDe(servidor, auth: auth);
    addTearDown(container.dispose);

    expect(await esperar(container, meProvider), isNull);
    expect(auth.llamadas, contains('cerrar'));
    expect(auth.actual, isNull);
    expect(container.read(motivoCierreProvider), contains('no está vigente'));
  });

  test('otros errores de /me se propagan como ApiException', () async {
    final servidor = ServidorFalso()..sinRed = true;
    final container = contenedorDe(servidor);
    addTearDown(container.dispose);

    await expectLater(esperar(container, meProvider), throwsA(predicate((e) => e.toString().contains('SIN_CONEXION'))));
  });
}
