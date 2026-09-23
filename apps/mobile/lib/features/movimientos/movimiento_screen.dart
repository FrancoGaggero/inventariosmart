import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../app/shell.dart';
import '../../app/theme.dart';
import '../../core/formato.dart';
import '../../core/modelos/movimiento.dart';
import '../../core/modelos/producto.dart';
import '../../ui/aviso.dart';
import '../../ui/estado_carga.dart';
import '../inventario/inventario_provider.dart';
import 'movimiento_provider.dart';

/// Registrar venta, ingreso o ajuste desde el mostrador (CP-M.4).
class MovimientoScreen extends ConsumerStatefulWidget {
  const MovimientoScreen({super.key, this.productoId});

  /// Producto precargado desde "Vender" en el inventario (CP-M.4f).
  final String? productoId;

  @override
  ConsumerState<MovimientoScreen> createState() => _MovimientoScreenState();
}

class _MovimientoScreenState extends ConsumerState<MovimientoScreen> {
  final _cantidad = TextEditingController();
  final _observacion = TextEditingController();

  @override
  void initState() {
    super.initState();
    final estado = ref.read(movimientoProvider);
    _cantidad.text = estado.cantidad;
    _observacion.text = estado.observacion;
  }

  @override
  void dispose() {
    _cantidad.dispose();
    _observacion.dispose();
    super.dispose();
  }

  void _sincronizar(EstadoMovimiento e) {
    if (_cantidad.text != e.cantidad) _cantidad.text = e.cantidad;
    if (_observacion.text != e.observacion) _observacion.text = e.observacion;
  }

  Future<void> _elegirProducto() async {
    final elegido = await showModalBottomSheet<Producto>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const SelectorProducto(),
    );
    if (elegido != null) ref.read(movimientoProvider.notifier).elegirProducto(elegido);
  }

  @override
  Widget build(BuildContext context) {
    final estado = ref.watch(movimientoProvider);
    final notifier = ref.read(movimientoProvider.notifier);
    ref.listen(movimientoProvider, (_, e) => _sincronizar(e));

    // Precarga desde ?productoId= si todavía no es el producto elegido.
    final precarga = widget.productoId;
    if (precarga != null && estado.producto?.id != precarga) {
      final p = ref.watch(productoProvider(precarga));
      p.whenData((producto) {
        if (estado.producto?.id != producto.id) {
          Future.microtask(() => notifier.elegirProducto(producto));
        }
      });
      if (p.isLoading) return Scaffold(appBar: AppBar(title: const Text('Registrar movimiento')), body: const Cargando());
    }

    final producto = estado.producto;
    final motivos = motivosPorTipo[estado.tipo]!;
    final resultado = estado.resultado;

    return Scaffold(
      appBar: AppBar(title: const Text('Registrar movimiento'), actions: const [MenuSesion()]),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SegmentedButton<String>(
              segments: [
                for (final t in tiposMovimiento) ButtonSegment(value: t, label: Text(etiquetaTipo[t]!)),
              ],
              selected: {estado.tipo},
              onSelectionChanged: estado.enviando ? null : (s) => notifier.cambiarTipo(s.first),
            ),
            const SizedBox(height: 16),
            _SelectorProductoCampo(producto: producto, error: estado.errores['productoId'], onElegir: _elegirProducto),
            const SizedBox(height: 12),
            TextField(
              controller: _cantidad,
              onChanged: notifier.cambiarCantidad,
              keyboardType: TextInputType.numberWithOptions(signed: estado.tipo == 'AJUSTE'),
              inputFormatters: [FilteringTextInputFormatter.allow(RegExp(estado.tipo == 'AJUSTE' ? r'[-0-9]' : r'[0-9]'))],
              decoration: InputDecoration(
                labelText: estado.tipo == 'AJUSTE' ? 'Cantidad (negativa para restar)' : 'Cantidad',
                errorText: estado.errores['cantidad'],
                helperText: producto == null ? null : 'Stock actual: ${formatoEntero(producto.stockActual)}',
              ),
            ),
            if (estado.tipo == 'VENTA' && producto != null) ...[
              const SizedBox(height: 8),
              Text(
                'Precio de venta vigente: ${formatoPesos(producto.precioVenta)} (con IVA). La venta se registra a ese precio.',
                style: const TextStyle(color: AppColors.t2, fontSize: 12),
              ),
            ],
            if (motivos.isNotEmpty) ...[
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: ValueKey('motivo-${estado.tipo}'),
                initialValue: estado.motivo,
                decoration: InputDecoration(
                  labelText: estado.tipo == 'AJUSTE' ? 'Motivo del ajuste' : 'Motivo (opcional)',
                  errorText: estado.errores['motivo'],
                ),
                items: [for (final m in motivos) DropdownMenuItem(value: m, child: Text(etiquetaMotivo[m]!))],
                onChanged: estado.enviando ? null : notifier.cambiarMotivo,
              ),
            ],
            const SizedBox(height: 12),
            TextField(
              controller: _observacion,
              onChanged: notifier.cambiarObservacion,
              maxLength: 200,
              decoration: InputDecoration(labelText: 'Observación (opcional)', errorText: estado.errores['observacion']),
            ),
            if (estado.error != null) ...[
              Aviso(estado.error!, tono: TonoAviso.error),
              const SizedBox(height: 12),
            ],
            if (resultado != null) ...[
              _Resultado(movimiento: resultado, stockSeguridad: producto?.stockSeguridad),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: OutlinedButton(onPressed: notifier.otro, child: const Text('Registrar otro'))),
                  const SizedBox(width: 12),
                  Expanded(
                    child: OutlinedButton(
                      onPressed: () {
                        notifier.reiniciar();
                        context.go(Rutas.inventario);
                      },
                      child: const Text('Ver inventario'),
                    ),
                  ),
                ],
              ),
            ] else
              FilledButton(
                onPressed: estado.enviando ? null : notifier.enviar,
                child: Text(estado.error != null ? 'Reintentar' : 'Registrar ${etiquetaTipo[estado.tipo]!.toLowerCase()}'),
              ),
          ],
        ),
      ),
    );
  }
}

class _SelectorProductoCampo extends StatelessWidget {
  const _SelectorProductoCampo({required this.producto, required this.error, required this.onElegir});

  final Producto? producto;
  final String? error;
  final VoidCallback onElegir;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onElegir,
      borderRadius: BorderRadius.circular(8),
      child: InputDecorator(
        decoration: InputDecoration(
          labelText: 'Producto',
          errorText: error,
          suffixIcon: const Icon(Icons.search),
        ),
        child: producto == null
            ? const Text('Elegí un producto', style: TextStyle(color: AppColors.t2))
            : Text('${producto!.codigo} · ${producto!.nombre}', maxLines: 1, overflow: TextOverflow.ellipsis),
      ),
    );
  }
}

/// Hoja inferior con buscador (GET /products?q=) que devuelve el producto elegido.
class SelectorProducto extends ConsumerStatefulWidget {
  const SelectorProducto({super.key});

  @override
  ConsumerState<SelectorProducto> createState() => _SelectorProductoState();
}

class _SelectorProductoState extends ConsumerState<SelectorProducto> {
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final productos = ref.watch(buscarProductosProvider(_q));
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.75,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: TextField(
                autofocus: true,
                onChanged: (v) => setState(() => _q = v),
                decoration: const InputDecoration(hintText: 'Buscar por código o nombre', prefixIcon: Icon(Icons.search)),
              ),
            ),
            Expanded(
              child: productos.when(
                loading: () => const Cargando(),
                error: (e, _) => ErrorConReintento(error: e, onReintentar: () => ref.invalidate(buscarProductosProvider(_q))),
                data: (items) => items.isEmpty
                    ? const Center(child: Text('No hay productos que coincidan.', style: TextStyle(color: AppColors.t2)))
                    : ListView.builder(
                        itemCount: items.length,
                        itemBuilder: (context, i) {
                          final p = items[i];
                          return ListTile(
                            leading: Icon(Icons.circle, size: 12, color: AppColors.estadoStock(p.estadoStock)),
                            title: Text(p.nombre, maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text('${p.codigo} · Stock ${formatoEntero(p.stockActual)} · ${formatoPesos(p.precioVenta)}'),
                            onTap: () => Navigator.of(context).pop(p),
                          );
                        },
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Texto del resultado (CP-M.4, CP-M.4e).
String textoResultado(Movimiento m, int? stockSeguridad) {
  final participio = m.tipo == 'VENTA' ? 'registrada' : 'registrado';
  final base = '${etiquetaTipo[m.tipo]} $participio. Stock resultante: ${formatoEntero(m.stockResultante)}.';
  if (m.tipo == 'INGRESO') return base;
  if (m.estadoStock == 'SIN_STOCK') {
    return '$base El producto quedó sin stock. Conviene reponer.';
  }
  if (m.estadoStock == 'BAJO') {
    final seg = stockSeguridad == null ? '' : ' (${formatoEntero(stockSeguridad)})';
    return '$base Quedan ${formatoEntero(m.stockResultante)} unidades, por debajo del stock de seguridad$seg. Conviene reponer.';
  }
  return base;
}

class _Resultado extends StatelessWidget {
  const _Resultado({required this.movimiento, required this.stockSeguridad});

  final Movimiento movimiento;
  final int? stockSeguridad;

  @override
  Widget build(BuildContext context) {
    final ok = movimiento.estadoStock == 'OK';
    return Aviso(textoResultado(movimiento, stockSeguridad), tono: ok ? TonoAviso.ok : TonoAviso.warn);
  }
}
