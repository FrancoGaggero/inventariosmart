import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/auth/auth_repository.dart';
import '../../core/auth/sesion.dart';
import '../../ui/aviso.dart';

/// Acceso con email y contraseña o Google, y creación de cuenta (CP-M.1 a CP-M.1e).
/// Al entrar, el router redirige solo cuando cambia la sesión.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirmar = TextEditingController();
  final _nombre = TextEditingController();
  bool _crear = false;
  bool _enviando = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirmar.dispose();
    _nombre.dispose();
    super.dispose();
  }

  Future<void> _correr(Future<void> Function() accion) async {
    setState(() {
      _error = null;
      _enviando = true;
    });
    ref.read(motivoCierreProvider.notifier).fijar(null);
    try {
      await accion();
    } on AuthException catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'No pudimos completar la operación.');
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  String? _validarLocal() {
    final email = _email.text.trim();
    if (email.isEmpty || !email.contains('@')) return 'El email no tiene un formato válido.';
    if (_password.text.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres.';
    if (_crear && _password.text != _confirmar.text) return 'Las contraseñas no coinciden.';
    return null;
  }

  Future<void> _enviarEmail() async {
    final local = _validarLocal();
    if (local != null) {
      setState(() => _error = local);
      return;
    }
    final repo = ref.read(authRepositoryProvider);
    await _correr(() => _crear
        ? repo.crearCuenta(_email.text, _password.text, _nombre.text)
        : repo.ingresarConEmail(_email.text, _password.text));
  }

  Future<void> _enviarGoogle() => _correr(() => ref.read(authRepositoryProvider).ingresarConGoogle());

  @override
  Widget build(BuildContext context) {
    final motivo = ref.watch(motivoCierreProvider);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: AutofillGroup(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const _Logo(),
                    const SizedBox(height: 28),
                    Text(
                      _crear ? 'Creá tu cuenta' : 'Ingresá a tu comercio',
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _crear
                          ? 'Usá el mismo email que vas a usar en la web.'
                          : 'La misma cuenta que usás en la web.',
                      style: const TextStyle(color: AppColors.t2),
                    ),
                    const SizedBox(height: 20),
                    if (motivo != null && _error == null) ...[
                      Aviso(motivo, tono: TonoAviso.warn),
                      const SizedBox(height: 12),
                    ],
                    if (_crear) ...[
                      TextField(
                        controller: _nombre,
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.name],
                        decoration: const InputDecoration(labelText: 'Tu nombre'),
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      autocorrect: false,
                      decoration: const InputDecoration(labelText: 'Email'),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: _password,
                      obscureText: true,
                      textInputAction: _crear ? TextInputAction.next : TextInputAction.done,
                      autofillHints: [_crear ? AutofillHints.newPassword : AutofillHints.password],
                      onSubmitted: (_) => _crear ? null : _enviarEmail(),
                      decoration: const InputDecoration(labelText: 'Contraseña'),
                    ),
                    if (_crear) ...[
                      const SizedBox(height: 12),
                      TextField(
                        controller: _confirmar,
                        obscureText: true,
                        textInputAction: TextInputAction.done,
                        onSubmitted: (_) => _enviarEmail(),
                        decoration: const InputDecoration(labelText: 'Repetí la contraseña'),
                      ),
                    ],
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Aviso(_error!, tono: TonoAviso.error),
                    ],
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: _enviando ? null : _enviarEmail,
                      child: Text(_crear ? 'Crear cuenta' : 'Ingresar'),
                    ),
                    const SizedBox(height: 10),
                    OutlinedButton.icon(
                      onPressed: _enviando ? null : _enviarGoogle,
                      icon: const Icon(Icons.g_mobiledata_rounded, size: 26),
                      label: const Text('Continuar con Google'),
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: _enviando
                          ? null
                          : () => setState(() {
                                _crear = !_crear;
                                _error = null;
                              }),
                      child: Text(_crear ? 'Ya tengo cuenta: ingresar' : 'No tengo cuenta: crear cuenta'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            gradient: const LinearGradient(colors: [AppColors.brand, Color(0xFF8B5CF6)]),
          ),
          child: const Icon(Icons.bar_chart_rounded, color: Colors.white, size: 22),
        ),
        const SizedBox(width: 10),
        const Text('InventarioSmart', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800)),
      ],
    );
  }
}
