import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/auth/sesion.dart';
import '../ui/estado_carga.dart';

/// Pantalla de espera mientras se restaura la sesión y se consulta /me.
/// Si /me falla (sin red, API caída) muestra el error con "Reintentar" (CP-M.5).
class CargandoScreen extends ConsumerWidget {
  const CargandoScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider);
    return Scaffold(
      body: SafeArea(
        child: me.hasError && !me.isLoading
            ? Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ErrorConReintento(error: me.error!, onReintentar: () => ref.invalidate(meProvider)),
                  TextButton(onPressed: () => ref.read(cerrarSesionProvider)(), child: const Text('Cerrar sesión')),
                ],
              )
            : const Cargando(),
      ),
    );
  }
}
