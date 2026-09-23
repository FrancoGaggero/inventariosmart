import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Persona autenticada en Firebase (independiente del comercio y del rol, que los resuelve la API).
class UsuarioAuth {
  const UsuarioAuth({required this.uid, required this.email, this.nombre});

  final String uid;
  final String email;
  final String? nombre;
}

/// Error de autenticación ya traducido al español (CP-M.1c, CP-M.1d).
class AuthException implements Exception {
  AuthException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => '$code: $message';
}

/// Puerta única a Firebase Authentication. La implementación real vive en
/// `firebase_auth_repository.dart`; los tests usan [AuthRepositoryFalso].
abstract class AuthRepository {
  Stream<UsuarioAuth?> get cambios;
  UsuarioAuth? get actual;
  Future<String?> idToken();
  Future<void> ingresarConEmail(String email, String password);
  Future<void> crearCuenta(String email, String password, String? nombre);
  Future<void> ingresarConGoogle();
  Future<void> cerrarSesion();
}

/// Se reemplaza en `main.dart` (Firebase) y en los tests (falso).
final authRepositoryProvider = Provider<AuthRepository>(
  (_) => throw UnimplementedError('authRepositoryProvider debe sobreescribirse.'),
);

/// Mensajes en español para los códigos de Firebase Auth (misma tabla que la web).
const mensajesFirebase = <String, String>{
  'invalid-credential': 'El email o la contraseña no son correctos.',
  'wrong-password': 'El email o la contraseña no son correctos.',
  'user-not-found': 'El email o la contraseña no son correctos.',
  'invalid-email': 'El email no tiene un formato válido.',
  'email-already-in-use': 'Ya existe una cuenta con ese email. Probá iniciar sesión.',
  'weak-password': 'La contraseña tiene que tener al menos 8 caracteres.',
  'too-many-requests': 'Demasiados intentos. Esperá unos minutos y volvé a probar.',
  'network-request-failed': 'Sin conexión. Revisá tu red e intentá de nuevo.',
  'user-disabled': 'Esta cuenta está deshabilitada.',
  'google-cancelado': 'Cerraste la ventana de Google antes de terminar.',
  'google-sin-configurar':
      'Google no está disponible en esta instalación. Podés entrar con tu email y contraseña.',
};

String mensajeFirebase(String code, [String porDefecto = 'No pudimos completar la operación.']) =>
    mensajesFirebase[code] ?? porDefecto;
