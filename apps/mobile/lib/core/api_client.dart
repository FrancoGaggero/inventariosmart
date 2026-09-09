import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config.dart';

/// Cliente HTTP único. Adjunta el ID token de Firebase cuando hay sesión
/// (en el sprint 0 no la hay: /health es pública).
final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: '${AppConfig.apiUrl}${AppConfig.apiPrefix}',
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: {'Accept': 'application/json'},
    ),
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final user = FirebaseAuth.instance.currentUser;
        if (user != null) {
          final token = await user.getIdToken();
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
    ),
  );

  return dio;
});

/// Error con el formato del contrato de la API: { code, message, details }.
class ApiException implements Exception {
  ApiException(this.code, this.message, {this.details});

  final String code;
  final String message;
  final Object? details;

  factory ApiException.fromDio(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['code'] is String && data['message'] is String) {
      return ApiException(data['code'] as String, data['message'] as String, details: data['details']);
    }
    return ApiException(
      'SIN_CONEXION',
      'No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.',
    );
  }

  @override
  String toString() => '$code: $message';
}
