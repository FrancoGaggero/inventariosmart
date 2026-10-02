import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/tema_provider.dart';
import '../../app/theme.dart';
import '../../core/auth/sesion.dart';
import '../../core/modelos/me.dart';
import 'secciones.dart';

/// Pestaña "Más": pantallas secundarias, la cuenta, el tema y el cierre de sesión (CP-M.8 a CP-M.8e).
class MasScreen extends ConsumerWidget {
  const MasScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final k = context.tokens;
    return Scaffold(
      appBar: AppBar(title: const Text('Más')),
      body: me == null
          ? const SizedBox.shrink()
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: [
                _Cuenta(me: me),
                for (final s in seccionesMas(me)) ...[
                  _Titulo(s.titulo),
                  Card(
                    child: Column(
                      children: [
                        for (final e in s.entradas)
                          ListTile(
                            leading: Icon(e.icono, color: k.brand3),
                            title: Text(e.etiqueta),
                            subtitle: e.detalle == null ? null : Text(e.detalle!),
                            trailing: Icon(Icons.chevron_right, color: k.t3),
                            onTap: () => context.push(e.ruta),
                          ),
                      ],
                    ),
                  ),
                ],
                const _Titulo('Apariencia'),
                const _SelectorTema(),
                const _Titulo('En la web'),
                const _EnLaWeb(),
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(foregroundColor: k.crit, side: BorderSide(color: k.crit)),
                  onPressed: () => ref.read(cerrarSesionProvider)(),
                  icon: const Icon(Icons.logout),
                  label: const Text('Cerrar sesión'),
                ),
              ],
            ),
    );
  }
}

class _Titulo extends StatelessWidget {
  const _Titulo(this.texto);

  final String texto;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(4, 20, 4, 8),
        child: Text(
          texto,
          style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, letterSpacing: 0.5, color: context.tokens.t2),
        ),
      );
}

class _Cuenta extends StatelessWidget {
  const _Cuenta({required this.me});

  final Me me;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    final inicial = me.comercio.nombre.trim().isEmpty ? '?' : me.comercio.nombre.trim()[0].toUpperCase();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            CircleAvatar(
              radius: 22,
              backgroundColor: k.brand,
              child: Text(inicial, style: TextStyle(color: k.onBrand, fontWeight: FontWeight.w800, fontSize: 18)),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    me.comercio.nombre,
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: k.t1),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 2),
                  Text(
                    me.usuario.email,
                    style: TextStyle(color: k.t2),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      _Pildora(nombreRol[me.rol] ?? me.rol),
                      _Pildora(nombrePlan[me.plan] ?? me.plan, destacada: true),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Pildora extends StatelessWidget {
  const _Pildora(this.texto, {this.destacada = false});

  final String texto;
  final bool destacada;

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: destacada ? k.brand.withValues(alpha: 0.18) : k.fill,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: destacada ? k.brand.withValues(alpha: 0.5) : k.line2),
      ),
      child: Text(texto, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: k.t1)),
    );
  }
}

class _SelectorTema extends ConsumerWidget {
  const _SelectorTema();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final actual = ref.watch(temaProvider);
    return SegmentedButton<PreferenciaTema>(
      segments: [
        for (final p in PreferenciaTema.values)
          ButtonSegment(
            value: p,
            label: Text(p.etiqueta),
            icon: Icon(switch (p) {
              PreferenciaTema.sistema => Icons.brightness_auto_outlined,
              PreferenciaTema.claro => Icons.light_mode_outlined,
              PreferenciaTema.oscuro => Icons.dark_mode_outlined,
            }),
          ),
      ],
      selected: {actual},
      showSelectedIcon: false,
      onSelectionChanged: (s) => ref.read(temaProvider.notifier).elegir(s.first),
    );
  }
}

class _EnLaWeb extends StatelessWidget {
  const _EnLaWeb();

  @override
  Widget build(BuildContext context) {
    final k = context.tokens;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Estas tareas se manejan desde la web:', style: TextStyle(color: k.t2)),
            const SizedBox(height: 8),
            for (final t in tareasDeLaWeb)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 7, right: 10),
                      child: Icon(Icons.circle, size: 6, color: k.brand3),
                    ),
                    Expanded(child: Text(t)),
                  ],
                ),
              ),
            const SizedBox(height: 10),
            Row(
              children: [
                Icon(Icons.language, size: 18, color: k.brand3),
                const SizedBox(width: 8),
                Expanded(
                  child: SelectableText(
                    direccionWeb,
                    style: TextStyle(fontWeight: FontWeight.w700, color: k.t1),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
