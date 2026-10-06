import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/theme.dart';
import '../../core/asistente_formato.dart';
import '../../ui/analisis_ui.dart';
import '../../ui/estado_carga.dart';
import 'asistente_provider.dart';

/// Conversaciones anteriores del dueño (CP-M.12f, CP-M.12k).
class ConversacionesScreen extends ConsumerWidget {
  const ConversacionesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = context.tokens;
    final lista = ref.watch(conversacionesProvider);
    final actual = ref.watch(chatProvider.select((c) => c.conversacionId));
    return Scaffold(
      appBar: AppBar(title: const Text('Conversaciones')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(conversacionesProvider.future),
        child: switch (lista) {
          AsyncValue(:final value?) => ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                if (value.datos.items.isEmpty)
                  const Vacio(
                    titulo: 'Todavía no hay conversaciones.',
                    texto: 'Las consultas que le hagas al asistente quedan acá para seguirlas después.',
                    icono: Icons.forum_outlined,
                    ilustracion: 'flechas',
                  ),
                for (final c in value.datos.items) ...[
                  Card(
                    margin: EdgeInsets.zero,
                    clipBehavior: Clip.antiAlias,
                    child: ListTile(
                      leading: Icon(Icons.chat_bubble_outline, color: c.id == actual ? k.brand3 : k.t2),
                      title: Text(c.titulo, maxLines: 2, overflow: TextOverflow.ellipsis),
                      subtitle: Text(fechaDeConversacion(c.actualizadoEn)),
                      trailing: Icon(Icons.chevron_right, color: k.t3),
                      onTap: () {
                        ref.read(chatProvider.notifier).abrir(c.id);
                        context.pop();
                      },
                    ),
                  ),
                  const SizedBox(height: 8),
                ],
                CargarMas(
                  hayMas: value.datos.hayMas,
                  cargando: value.cargandoMas,
                  error: value.errorMas,
                  onCargar: () => ref.read(conversacionesProvider.notifier).cargarMas(),
                ),
              ],
            ),
          AsyncValue(hasError: true, :final error?) => ListView(
              children: [ErrorConReintento(error: error, onReintentar: () => ref.invalidate(conversacionesProvider))],
            ),
          AsyncValue(hasValue: true) => const SizedBox.shrink(),
          _ => const Cargando(),
        },
      ),
    );
  }
}
