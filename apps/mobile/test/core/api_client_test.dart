import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/core/api_client.dart';
import 'package:inventariosmart_mobile/core/auth/auth_repository.dart';

import '../auth_falso.dart';

/// Adaptador que responde recién cuando el test completa el pedido.
class AdaptadorLento implements HttpClientAdapter {
  final pendientes = <Completer<void>>[];

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    final c = Completer<void>();
    pendientes.add(c);
    await c.future;
    return ResponseBody.fromString('{}', 200, headers: {'content-type': ['application/json']});
  }

  void responderTodo() {
    for (final c in pendientes) {
      if (!c.isCompleted) c.complete();
    }
  }

  @override
  void close({bool force = false}) {}
}

/// El `dioProvider` real (con su interceptor) sobre el adaptador lento.
(ProviderContainer, Dio, AdaptadorLento) armar() {
  final c = ProviderContainer(overrides: [authRepositoryProvider.overrideWithValue(AuthRepositoryFalso())]);
  final dio = c.read(dioProvider);
  final adaptador = AdaptadorLento();
  dio.httpClientAdapter = adaptador;
  return (c, dio, adaptador);
}

/// Avanza el reloj de prueba hasta que el pedido termine (un `await` directo se queda esperando).
Future<void> esperar(WidgetTester tester, Future<Object?> pedido) async {
  var listo = false;
  unawaited(pedido.whenComplete(() => listo = true));
  for (var i = 0; i < 50 && !listo; i++) {
    await tester.pump(const Duration(milliseconds: 20));
  }
  expect(listo, isTrue);
}

void main() {
  testWidgets('CP-M.5b el aviso de "despertando" se enciende en cada pedido lento, no sólo el primero', (tester) async {
    final (c, dio, adaptador) = armar();
    addTearDown(c.dispose);

    for (var vez = 1; vez <= 2; vez++) {
      final pedido = dio.get<Object?>('/health');
      await tester.pump(const Duration(seconds: 6));
      expect(c.read(apiDespertandoProvider), isTrue, reason: 'pedido $vez');
      adaptador.responderTodo();
      await esperar(tester, pedido);
      expect(c.read(apiDespertandoProvider), isFalse, reason: 'pedido $vez');
    }
  });

  testWidgets('un pedido con sinAvisoDespertar no enciende el aviso', (tester) async {
    final (c, dio, adaptador) = armar();
    addTearDown(c.dispose);

    final pedido = dio.post<Object?>('/assistant/messages', options: Options(extra: {sinAvisoDespertar: true}));
    await tester.pump(const Duration(seconds: 30));
    expect(c.read(apiDespertandoProvider), isFalse);
    adaptador.responderTodo();
    await esperar(tester, pedido);
    expect(c.read(apiDespertandoProvider), isFalse);
  });
}
