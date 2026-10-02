import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/sesion.dart';
import '../core/modelos/me.dart';

/// Pestañas de la app; el índice coincide con las ramas del `StatefulShellRoute` (D4).
enum Pestania {
  inicio('Inicio', Icons.dashboard_outlined, Icons.dashboard),
  inventario('Inventario', Icons.inventory_2_outlined, Icons.inventory_2),
  movimiento('Movimiento', Icons.point_of_sale_outlined, Icons.point_of_sale),
  mas('Más', Icons.menu_outlined, Icons.menu);

  const Pestania(this.etiqueta, this.icono, this.iconoActivo);

  final String etiqueta;
  final IconData icono;
  final IconData iconoActivo;
}

/// Pestañas visibles según el rol (CP-M.2e, CP-M.3d, CP-M.4g); "Más" va siempre al final (CP-M.8, CP-M.8b).
List<Pestania> pestaniasDe(Me me) => [
      if (me.vePanel) Pestania.inicio,
      if (me.veInventario) Pestania.inventario,
      if (me.registraMovimientos) Pestania.movimiento,
      Pestania.mas,
    ];

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    final visibles = me == null ? const <Pestania>[] : pestaniasDe(me);
    final actual = Pestania.values[navigationShell.currentIndex];
    final indiceVisible = visibles.indexOf(actual);

    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: visibles.length < 2
          ? null
          : NavigationBar(
              selectedIndex: indiceVisible < 0 ? 0 : indiceVisible,
              onDestinationSelected: (i) {
                final destino = visibles[i];
                navigationShell.goBranch(destino.index, initialLocation: destino == actual);
              },
              destinations: [
                for (final p in visibles)
                  NavigationDestination(icon: Icon(p.icono), selectedIcon: Icon(p.iconoActivo), label: p.etiqueta),
              ],
            ),
    );
  }
}
