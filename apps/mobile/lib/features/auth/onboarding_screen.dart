import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app/theme.dart';
import '../../core/api_client.dart';
import '../../core/auth/sesion.dart';
import '../../ui/aviso.dart';

/// Primer ingreso del dueño: nombre del comercio (CP-M.1g). La importación Excel es web.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _nombre = TextEditingController();
  bool _enviando = false;
  String? _error;

  @override
  void dispose() {
    _nombre.dispose();
    super.dispose();
  }

  Future<void> _guardar() async {
    final nombre = _nombre.text.trim();
    if (nombre.length < 2) {
      setState(() => _error = 'El nombre del comercio debe tener al menos 2 caracteres.');
      return;
    }
    setState(() {
      _error = null;
      _enviando = true;
    });
    try {
      await ref.read(dioProvider).post<void>('/me/onboarding', data: {'nombreComercio': nombre});
      // El router redirige al inicio cuando /me deja de tener el onboarding pendiente.
      ref.invalidate(meProvider);
    } on DioException catch (e) {
      final error = ApiException.fromDio(e);
      setState(() => _error = error.detalleDe('nombreComercio') ?? error.message);
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final me = ref.watch(meProvider).value;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      color: AppColors.brand.withValues(alpha: 0.15),
                    ),
                    child: const Icon(Icons.storefront_outlined, color: AppColors.brand3),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'PRIMER PASO',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.w800, letterSpacing: 2, color: AppColors.brand3),
                  ),
                  const SizedBox(height: 8),
                  const Text('¿Cómo se llama tu comercio?', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 6),
                  Text(
                    'Hola ${me?.usuario.nombre ?? me?.usuario.email ?? ''}. Este nombre aparece en tus reportes y '
                    'podés cambiarlo cuando quieras desde la web.',
                    style: const TextStyle(color: AppColors.t2),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _nombre,
                    autofocus: true,
                    textInputAction: TextInputAction.done,
                    onSubmitted: (_) => _guardar(),
                    decoration: const InputDecoration(labelText: 'Nombre del comercio', hintText: 'Repuestos Carlos'),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Aviso(_error!, tono: TonoAviso.error),
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _enviando ? null : _guardar,
                    child: const Text('Guardar y continuar'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _enviando ? null : () => ref.read(cerrarSesionProvider)(),
                    child: const Text('Cerrar sesión'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
