import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/auth/sesion.dart';
import '../core/modelos/me.dart';
import 'theme.dart';

/// Pestañas de la app; el índice coincide con las ramas del `StatefulShellRoute` (D4).
enum Pestania {
  inicio('Inicio', Icons.dashboard_outlined, Icons.dashboard),
  inventario('Inventario', Icons.inventory_2_outlined, Icons.inventory_2),
  movimiento('Movimiento', Icons.point_of_sale_outlined, Icons.point_of_sale);

  const Pestania(this.etiqueta, this.icono, this.iconoActivo);

  final String etiqueta;
  final IconData icono;
  final IconData iconoActivo;
}

/// Pestañas visibles según el rol (CP-M.2e, CP-M.3d, CP-M.4g).
List<Pestania> pestaniasDe(Me me) => [
      if (me.vePanel) Pestania.inicio,
      if (me.veInventario) Pestania.inventario,
      if (me.registraMovimientos) Pestania.movimiento,
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

/// Menú de la barra superior: comercio, rol y "Cerrar sesión" (CP-M.1h).
class MenuSesion extends ConsumerWidget {
  const MenuSesion({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final me = ref.watch(meProvider).value;
    return PopupMenuButton<String>(
      tooltip: 'Cuenta',
      icon: const Icon(Icons.account_circle_outlined),
      onSelected: (v) {
        if (v == 'salir') ref.read(cerrarSesionProvider)();
      },
      itemBuilder: (context) => [
        PopupMenuItem<String>(
          enabled: false,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(me?.comercio.nombre ?? '', style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.t1)),
              Text(
                '${me?.usuario.email ?? ''} · ${nombreRol[me?.rol] ?? ''}',
                style: const TextStyle(fontSize: 12, color: AppColors.t2),
              ),
            ],
          ),
        ),
        const PopupMenuDivider(),
        const PopupMenuItem<String>(
          value: 'salir',
          child: ListTile(leading: Icon(Icons.logout), title: Text('Cerrar sesión'), contentPadding: EdgeInsets.zero),
        ),
      ],
    );
  }
}
