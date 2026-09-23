import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import 'auth_repository.dart';

/// Implementación real sobre Firebase Authentication (email/contraseña y Google).
/// Sólo `main.dart` la instancia; los tests usan un repositorio falso.
class FirebaseAuthRepository implements AuthRepository {
  FirebaseAuthRepository({FirebaseAuth? auth, GoogleSignIn? google})
      : _auth = auth ?? FirebaseAuth.instance,
        _google = google ?? GoogleSignIn.instance;

  final FirebaseAuth _auth;
  final GoogleSignIn _google;
  bool _googleListo = false;

  static UsuarioAuth? _aUsuario(User? u) =>
      u == null ? null : UsuarioAuth(uid: u.uid, email: u.email ?? '', nombre: u.displayName);

  @override
  Stream<UsuarioAuth?> get cambios => _auth.authStateChanges().map(_aUsuario);

  @override
  UsuarioAuth? get actual => _aUsuario(_auth.currentUser);

  @override
  Future<String?> idToken() async {
    final u = _auth.currentUser;
    if (u == null) return null;
    try {
      return await u.getIdToken();
    } on FirebaseAuthException {
      return null;
    }
  }

  @override
  Future<void> ingresarConEmail(String email, String password) => _traducir(
        () => _auth.signInWithEmailAndPassword(email: email.trim(), password: password),
      );

  @override
  Future<void> crearCuenta(String email, String password, String? nombre) => _traducir(() async {
        final cred = await _auth.createUserWithEmailAndPassword(email: email.trim(), password: password);
        if (nombre != null && nombre.trim().isNotEmpty) {
          await cred.user?.updateDisplayName(nombre.trim());
        }
      });

  @override
  Future<void> ingresarConGoogle() async {
    try {
      if (!_googleListo) {
        await _google.initialize();
        _googleListo = true;
      }
      final cuenta = await _google.authenticate();
      final idToken = cuenta.authentication.idToken;
      if (idToken == null) {
        throw AuthException('google-sin-configurar', mensajeFirebase('google-sin-configurar'));
      }
      await _traducir(() => _auth.signInWithCredential(GoogleAuthProvider.credential(idToken: idToken)));
    } on GoogleSignInException catch (e) {
      final code = switch (e.code) {
        GoogleSignInExceptionCode.canceled ||
        GoogleSignInExceptionCode.interrupted =>
          'google-cancelado',
        GoogleSignInExceptionCode.clientConfigurationError ||
        GoogleSignInExceptionCode.providerConfigurationError ||
        GoogleSignInExceptionCode.uiUnavailable =>
          'google-sin-configurar',
        _ => 'google-error',
      };
      throw AuthException(code, mensajeFirebase(code, 'No pudimos entrar con Google. Probá de nuevo.'));
    }
  }

  @override
  Future<void> cerrarSesion() async {
    await _auth.signOut();
    if (_googleListo) {
      try {
        await _google.signOut();
      } on GoogleSignInException {
        // Sin sesión de Google que cerrar.
      }
    }
  }

  Future<T> _traducir<T>(Future<T> Function() accion) async {
    try {
      return await accion();
    } on FirebaseAuthException catch (e) {
      throw AuthException(e.code, mensajeFirebase(e.code));
    }
  }
}
