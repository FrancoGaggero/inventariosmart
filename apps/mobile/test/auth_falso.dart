import 'dart:async';

import 'package:inventariosmart_mobile/core/auth/auth_repository.dart';

/// Repositorio de autenticación en memoria para los tests (sin Firebase).
class AuthRepositoryFalso implements AuthRepository {
  AuthRepositoryFalso({UsuarioAuth? inicial, this.fallaEmail, this.fallaGoogle}) : _actual = inicial;

  static const usuaria = UsuarioAuth(uid: 'uid-ana', email: 'ana@ejemplo.com', nombre: 'Ana');

  UsuarioAuth? _actual;
  final _controller = StreamController<UsuarioAuth?>.broadcast();

  /// Código de error de Firebase a simular en ingreso/creación por email.
  final String? fallaEmail;

  /// Código de error a simular en Google.
  final String? fallaGoogle;

  final List<String> llamadas = [];

  /// Como Firebase: emite el estado actual al suscribirse y después cada cambio.
  @override
  Stream<UsuarioAuth?> get cambios async* {
    yield _actual;
    yield* _controller.stream;
  }

  @override
  UsuarioAuth? get actual => _actual;

  @override
  Future<String?> idToken() async => _actual == null ? null : 'token-${_actual!.uid}';

  void _entrar(UsuarioAuth u) {
    _actual = u;
    _controller.add(u);
  }

  @override
  Future<void> ingresarConEmail(String email, String password) async {
    llamadas.add('email:$email');
    if (fallaEmail != null) throw AuthException(fallaEmail!, mensajeFirebase(fallaEmail!));
    _entrar(UsuarioAuth(uid: 'uid-$email', email: email));
  }

  @override
  Future<void> crearCuenta(String email, String password, String? nombre) async {
    llamadas.add('crear:$email');
    if (fallaEmail != null) throw AuthException(fallaEmail!, mensajeFirebase(fallaEmail!));
    _entrar(UsuarioAuth(uid: 'uid-$email', email: email, nombre: nombre));
  }

  @override
  Future<void> ingresarConGoogle() async {
    llamadas.add('google');
    if (fallaGoogle != null) throw AuthException(fallaGoogle!, mensajeFirebase(fallaGoogle!));
    _entrar(usuaria);
  }

  @override
  Future<void> cerrarSesion() async {
    llamadas.add('cerrar');
    _actual = null;
    _controller.add(null);
  }
}
