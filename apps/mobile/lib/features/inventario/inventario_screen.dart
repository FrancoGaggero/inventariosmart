import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../app/shell.dart';
import '../../app/theme.dart';
import '../../core/auth/sesion.dart';
import '../../core/formato.dart';
import '../../core/modelos/producto.dart';
import '../../ui/aviso.dart';
import '../../ui/estado_carga.dart';
import 'inventario_provider.dart';

/// Inventario de mostrador: búsqueda, chips de estado y páginas por cursor (CP-M.3).
class InventarioScreen extends ConsumerStatefulWidget {
  const InventarioScreen({super.key, this.estadoInicial});

  /// Filtro de estado con el que se abre (desde las alertas del panel).
  final String? estadoInicial;

  @override
  ConsumerState<InventarioScreen> createState() => _InventarioScreenState();
}

class _InventarioScreenState extends ConsumerState<InventarioScreen> {
  final _buscador = TextEditingController();
  Timer? _rebote;

  @override
  void initState() {
    super.initState();
    final estado = widget.estadoInicial;
    if (estado != null && estadosStock.contains(estado)) {
      Future.microtask(() => ref.read(filtrosInventarioProvider.notifier).filtrarEstado(estado));
    }
  }

  @override
  void dispose() {
    _rebote?.cancel();
    _buscador.dispose();
    super.dispose();
  }

  void _alEscribir(String texto) {
    _rebote?.cancel();
    _rebote = Timer(const Duration(milliseconds: 300), () {
      ref.read(filtrosInventarioProvider.notifier).buscar(texto);
    });
  }

  @override
  Widget build(BuildContext context) {
    final filtros = ref.watch(filtrosInventarioProvider);
    final lista = ref.watch(inventarioProvider);
    final me = ref.watch(meProvider).value;
    final esDuenio = me?.esDuenio ?? false;

    return Scaffold(
      appBar: AppBar(title: const Text('Inventario'), actions: const [MenuSesion()]),
      floatingActionButton: esDuenio
          ? FloatingActionButton.extended(
              onPressed: () => context.go(Rutas.productoNuevo),
              icon: const Icon(Icons.add),
              label: const Text('Nuevo producto'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              controller: _buscador,
              onChanged: _alEscribir,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Buscar por código o nombre',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _buscador.text.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Limpiar',
                        icon: const Icon(Icons.close),
                        onPressed: () {
                          _buscador.clear();
                          _alEscribir('');
                        },
                      ),
              ),
            ),
          ),
          SizedBox(
            height: 52,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              children: [
                _Chip(etiqueta: 'Todos', activo: filtros.estado == null, onTap: () => _filtrar(null)),
                for (final e in const ['OK', 'BAJO', 'SIN_STOCK'])
                  _Chip(
                    etiqueta: etiquetaEstadoStock[e]!,
                    color: AppColors.estadoStock(e),
                    activo: filtros.estado == e,
                    onTap: () => _filtrar(e),
                  ),
              ],
            ),
          ),
          Expanded(
            child: switch (lista) {
              AsyncValue(:final value?) => _Lista(pagina: value, recargando: lista.isLoading, esDuenio: esDuenio, filtros: filtros),
              AsyncValue(hasError: true, :final error?) => ErrorConReintento(error: error, onReintentar: () => ref.invalidate(inventarioProvider)),
              _ => const Cargando(),
            },
          ),
        ],
      ),
    );
  }

  void _filtrar(String? estado) => ref.read(filtrosInventarioProvider.notifier).filtrarEstado(estado);
}

class _Chip extends StatelessWidget {
  const _Chip({required this.etiqueta, required this.activo, required this.onTap, this.color});

  final String etiqueta;
  final bool activo;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8),
      child: ChoiceChip(
        label: Text(etiqueta),
        selected: activo,
        onSelected: (_) => onTap(),
        avatar: color == null ? null : Icon(Icons.circle, size: 10, color: color),
      ),
    );
  }
}

class _Lista extends ConsumerWidget {
  const _Lista({required this.pagina, required this.recargando, required this.esDuenio, required this.filtros});

  final PaginaInventario pagina;
  final bool recargando;
  final bool esDuenio;
  final FiltrosInventario filtros;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (pagina.items.isEmpty) {
      final conFiltros = filtros.q.trim().isNotEmpty || filtros.estado != null;
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.inventory_2_outlined, size: 40, color: AppColors.t3),
              const SizedBox(height: 10),
              Text(
                conFiltros ? 'No hay productos que coincidan.' : 'Todavía no hay productos.',
                style: const TextStyle(fontWeight: FontWeight.w700),
              ),
              if (!conFiltros && esDuenio)
                const Padding(
                  padding: EdgeInsets.only(top: 6),
                  child: Text(
                    'Cargá el primero con "Nuevo producto" o importá tu planilla desde la web.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.t2),
                  ),
                ),
            ],
          ),
        ),
      );
    }
    final total = pagina.items.length;
    return RefreshIndicator(
      onRefresh: () => ref.refresh(inventarioProvider.future),
      child: Opacity(
        opacity: recargando ? 0.6 : 1,
        child: ListView.builder(
          padding: const EdgeInsets.only(bottom: 88),
          itemCount: total + 1,
          itemBuilder: (context, i) {
            if (i == total) return _PieDeLista(pagina: pagina);
            if (i >= total - 3 && pagina.hayMas && !pagina.cargandoMas) {
              Future.microtask(() => ref.read(inventarioProvider.notifier).cargarMas());
            }
            return _FilaProducto(producto: pagina.items[i]);
          },
        ),
      ),
    );
  }
}

class _PieDeLista extends ConsumerWidget {
  const _PieDeLista({required this.pagina});

  final PaginaInventario pagina;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (pagina.errorMas != null) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Aviso(
          pagina.errorMas!,
          tono: TonoAviso.error,
          accion: TextButton(onPressed: () => ref.read(inventarioProvider.notifier).cargarMas(), child: const Text('Reintentar')),
        ),
      );
    }
    if (pagina.cargandoMas) {
      return const Padding(padding: EdgeInsets.all(16), child: Center(child: CircularProgressIndicator()));
    }
    if (pagina.hayMas) {
      return Center(
        child: TextButton(onPressed: () => ref.read(inventarioProvider.notifier).cargarMas(), child: const Text('Cargar más')),
      );
    }
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Text('${pagina.items.length} productos', textAlign: TextAlign.center, style: const TextStyle(color: AppColors.t3, fontSize: 12)),
    );
  }
}

class _FilaProducto extends StatelessWidget {
  const _FilaProducto({required this.producto});

  final Producto producto;

  @override
  Widget build(BuildContext context) {
    final color = AppColors.estadoStock(producto.estadoStock);
    return ListTile(
      leading: Icon(Icons.circle, size: 12, color: color),
      title: Text(producto.nombre, maxLines: 1, overflow: TextOverflow.ellipsis),
      subtitle: Text(
        '${producto.codigo} · Stock ${formatoEntero(producto.stockActual)} · ${etiquetaEstadoStock[producto.estadoStock]}\n'
        '${formatoPesos(producto.precioVenta)}'
        '${producto.costoReposicion == null ? '' : ' · costo ${formatoPesos(producto.costoReposicion)}'}',
      ),
      isThreeLine: true,
      trailing: TextButton(
        onPressed: () => context.go('${Rutas.movimientoNuevo}?productoId=${producto.id}'),
        child: const Text('Vender'),
      ),
    );
  }
}
