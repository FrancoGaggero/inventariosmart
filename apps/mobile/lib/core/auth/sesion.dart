import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api_client.dart';
import '../modelos/me.dart';
import 'auth_repository.dart';

/// Sesión de Firebase: null sin sesión. Se restaura sola al abrir la app (CP-M.1f).
final sesionProvider = StreamProvider<UsuarioAuth?>((ref) {
  final repo = ref.watch(authRepositoryProvider);
  return repo.cambios;
});

/// Motivo por el que la app cerró la sesión sola (CP-M.1i); se muestra en el login.
class MotivoCierre extends Notifier<String?> {
  @override
  String? build() => null;

  void fijar(String? motivo) => state = motivo;
}

final motivoCierreProvider = NotifierProvider<MotivoCierre, String?>(MotivoCierre.new);

/// Usuario + comercio + rol resueltos por la API (GET /me). null sin sesión.
/// Un 401/403 acá significa que la sesión no sirve: se cierra y se explica en el login.
final meProvider = FutureProvider<Me?>((ref) async {
  final sesion = await ref.watch(sesionProvider.future);
  if (sesion == null) return null;
  final dio = ref.watch(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/me');
    return Me.fromJson(res.data!);
  } on DioException catch (e) {
    final error = ApiException.fromDio(e);
    if (error.esNoAutenticado || error.esSinPermiso) {
      ref.read(motivoCierreProvider.notifier).fijar(
            'Tu acceso no está vigente. Si creés que es un error, hablá con el dueño del comercio.',
          );
      await ref.read(authRepositoryProvider).cerrarSesion();
      return null;
    }
    throw error;
  }
});

/// Cierra la sesión a pedido de la persona (CP-M.1h): `ref.read(cerrarSesionProvider)()`.
final cerrarSesionProvider = Provider<Future<void> Function()>((ref) {
  return () async {
    ref.read(motivoCierreProvider.notifier).fijar(null);
    await ref.read(authRepositoryProvider).cerrarSesion();
  };
});
