import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import 'aviso.dart';

/// Indicador de carga que avisa cuando la API tarda en despertar (CP-M.5b).
class Cargando extends ConsumerWidget {
  const Cargando({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final despertando = ref.watch(apiDespertandoProvider);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            if (despertando) ...[
              const SizedBox(height: 16),
              const Text(
                'La API está despertando, puede tardar hasta un minuto.',
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Error de una consulta con botón "Reintentar" (CP-M.5, CP-M.5c).
class ErrorConReintento extends StatelessWidget {
  const ErrorConReintento({super.key, required this.error, required this.onReintentar});

  final Object error;
  final VoidCallback onReintentar;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Aviso(
        mensajeDe(error),
        tono: TonoAviso.error,
        accion: TextButton(onPressed: onReintentar, child: const Text('Reintentar')),
      ),
    );
  }
}
