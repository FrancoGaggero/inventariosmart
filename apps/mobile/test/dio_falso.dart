import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:inventariosmart_mobile/core/api_client.dart';
import 'package:inventariosmart_mobile/core/auth/auth_repository.dart';

import 'auth_falso.dart';

/// Respuesta fija para una ruta del servidor falso.
class RespuestaFalsa {
  const RespuestaFalsa(this.status, this.cuerpo);

  final int status;
  final Object? cuerpo;

  static RespuestaFalsa ok(Object? cuerpo) => RespuestaFalsa(200, cuerpo);
  static RespuestaFalsa creado(Object? cuerpo) => RespuestaFalsa(201, cuerpo);
  static RespuestaFalsa error(int status, String code, String message, {Object? details}) =>
      RespuestaFalsa(status, {'code': code, 'message': message, 'details': ?details});
}

typedef Manejador = RespuestaFalsa Function(RequestOptions req);

/// Adaptador HTTP en memoria: responde por "MÉTODO /ruta" (sin query) y registra cada pedido.
class ServidorFalso implements HttpClientAdapter {
  final Map<String, Manejador> rutas = {};
  final List<RequestOptions> pedidos = [];

  /// true simula un corte de red en todos los pedidos siguientes.
  bool sinRed = false;

  void responder(String metodo, String ruta, RespuestaFalsa respuesta) {
    rutas['$metodo $ruta'] = (_) => respuesta;
  }

  void manejar(String metodo, String ruta, Manejador manejador) {
    rutas['$metodo $ruta'] = manejador;
  }

  List<RequestOptions> pedidosA(String metodo, String ruta) =>
      pedidos.where((p) => p.method == metodo && p.uri.path.endsWith(ruta)).toList();

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    pedidos.add(options);
    if (sinRed) {
      throw DioException.connectionError(requestOptions: options, reason: 'sin red');
    }
    final clave = '${options.method} ${options.uri.path.replaceFirst('/api/v1', '')}';
    final manejador = rutas[clave];
    if (manejador == null) {
      return ResponseBody.fromString(
        jsonEncode({'code': 'NO_ENCONTRADO', 'message': 'Ruta sin respuesta falsa: $clave'}),
        404,
        headers: {'content-type': ['application/json']},
      );
    }
    final r = manejador(options);
    return ResponseBody.fromString(
      jsonEncode(r.cuerpo),
      r.status,
      headers: {'content-type': ['application/json']},
    );
  }

  @override
  void close({bool force = false}) {}
}

/// Contenedor de tests: sin reintentos automáticos (la app tampoco los usa, ver main.dart).
ProviderContainer contenedorDe(ServidorFalso servidor, {AuthRepository? auth}) =>
    ProviderContainer(overrides: overridesDe(servidor, auth: auth), retry: (_, _) => null);

/// Overrides comunes: auth falsa + Dio real sobre el servidor falso (los interceptores se prueban).
List<Override> overridesDe(ServidorFalso servidor, {AuthRepository? auth}) {
  final repo = auth ?? AuthRepositoryFalso(inicial: AuthRepositoryFalso.usuaria);
  return [
    authRepositoryProvider.overrideWithValue(repo),
    dioProvider.overrideWith((ref) {
      final dio = Dio(
        BaseOptions(baseUrl: 'http://falso/api/v1', headers: {'Accept': 'application/json'}),
      )..httpClientAdapter = servidor;
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) async {
            final token = await ref.read(authRepositoryProvider).idToken();
            if (token != null) options.headers['Authorization'] = 'Bearer $token';
            handler.next(options);
          },
        ),
      );
      return dio;
    }),
  ];
}
