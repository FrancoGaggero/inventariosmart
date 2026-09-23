import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth/auth_repository.dart';
import 'config.dart';

/// Segundos de espera antes de avisar que la API (Render Free) se está despertando.
const kDemoraAviso = Duration(seconds: 5);

/// true mientras una consulta lleva más de [kDemoraAviso] sin respuesta (CP-M.5b).
class ApiDespertando extends Notifier<bool> {
  @override
  bool build() => false;

  void marcar(bool valor) {
    if (state != valor) state = valor;
  }
}

final apiDespertandoProvider = NotifierProvider<ApiDespertando, bool>(ApiDespertando.new);

/// Cliente HTTP único. Adjunta el ID token de Firebase cuando hay sesión y avisa
/// cuando la API tarda (arranque en frío del plan gratuito de Render).
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: '${AppConfig.apiUrl}${AppConfig.apiPrefix}',
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 60),
      headers: {'Accept': 'application/json'},
    ),
  );

  var enCurso = 0;
  Timer? temporizador;
  void termino() {
    enCurso -= 1;
    if (enCurso <= 0) {
      enCurso = 0;
      temporizador?.cancel();
      ref.read(apiDespertandoProvider.notifier).marcar(false);
    }
  }

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await ref.read(authRepositoryProvider).idToken();
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        enCurso += 1;
        temporizador ??= Timer(kDemoraAviso, () {
          ref.read(apiDespertandoProvider.notifier).marcar(true);
        });
        handler.next(options);
      },
      onResponse: (response, handler) {
        termino();
        handler.next(response);
      },
      onError: (error, handler) {
        termino();
        handler.next(error);
      },
    ),
  );

  return dio;
});

/// Error con el formato del contrato de la API: { code, message, details }.
class ApiException implements Exception {
  ApiException(this.code, this.message, {this.details, this.status});

  final String code;
  final String message;
  final Object? details;

  /// Código HTTP; null cuando no hubo respuesta.
  final int? status;

  factory ApiException.fromDio(DioException e) {
    final data = e.response?.data;
    final status = e.response?.statusCode;
    if (data is Map && data['code'] is String && data['message'] is String) {
      return ApiException(
        data['code'] as String,
        data['message'] as String,
        details: data['details'],
        status: status,
      );
    }
    if (status != null) {
      return ApiException('HTTP_$status', 'El servidor respondió con un error ($status).', status: status);
    }
    return ApiException(
      'SIN_CONEXION',
      'No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.',
    );
  }

  bool get sinConexion => code == 'SIN_CONEXION';
  bool get esNoAutenticado => status == 401 || code == 'NO_AUTENTICADO';
  bool get esSinPermiso => status == 403 || code == 'SIN_PERMISO';

  /// Mensaje del primer detalle de validación por campo, si la API lo mandó.
  String? detalleDe(String campo) {
    final d = details;
    if (d is Map && d[campo] is String) return d[campo] as String;
    if (d is Map && d['campos'] is Map && (d['campos'] as Map)[campo] is String) {
      return (d['campos'] as Map)[campo] as String;
    }
    return null;
  }

  @override
  String toString() => '$code: $message';
}

/// Convierte cualquier error de una llamada HTTP en [ApiException].
ApiException comoApiException(Object error) {
  if (error is ApiException) return error;
  if (error is DioException) return ApiException.fromDio(error);
  return ApiException('DESCONOCIDO', 'Ocurrió un error inesperado.');
}

/// Mensaje para mostrar de cualquier error.
String mensajeDe(Object error) => comoApiException(error).message;
