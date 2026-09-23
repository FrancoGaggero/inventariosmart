import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../app/router.dart';
import '../../core/api_client.dart';
import '../../core/modelos/producto.dart';
import '../../ui/aviso.dart';
import '../inicio/inicio_screen.dart';
import 'inventario_provider.dart';

/// Alta rápida de producto para el DUENIO (CP-M.3e a CP-M.3g). Edición y baja: web.
class ProductoNuevoScreen extends ConsumerStatefulWidget {
  const ProductoNuevoScreen({super.key});

  @override
  ConsumerState<ProductoNuevoScreen> createState() => _ProductoNuevoScreenState();
}

class _ProductoNuevoScreenState extends ConsumerState<ProductoNuevoScreen> {
  final _codigo = TextEditingController();
  final _nombre = TextEditingController();
  final _precio = TextEditingController();
  final _costo = TextEditingController();
  final _stock = TextEditingController(text: '0');
  final _seguridad = TextEditingController(text: '0');
  final _errores = <String, String>{};
  String? _error;
  bool _enviando = false;

  @override
  void dispose() {
    for (final c in [_codigo, _nombre, _precio, _costo, _stock, _seguridad]) {
      c.dispose();
    }
    super.dispose();
  }

  /// "3.990,50" / "3990.50" → "3990.50"; null si no es un monto.
  static String? _monto(String texto) {
    var t = texto.trim().replaceAll(r'$', '').replaceAll(' ', '');
    if (t.contains(',')) t = t.replaceAll('.', '').replaceAll(',', '.');
    final n = double.tryParse(t);
    if (n == null || n < 0) return null;
    return n.toStringAsFixed(2);
  }

  bool _validar() {
    _errores.clear();
    if (_codigo.text.trim().isEmpty) _errores['codigo'] = 'El código es obligatorio.';
    if (_nombre.text.trim().isEmpty) _errores['nombre'] = 'El nombre es obligatorio.';
    if (_monto(_precio.text) == null) _errores['precioVenta'] = 'Ingresá el precio de venta con IVA.';
    if (_monto(_costo.text) == null) _errores['costoReposicion'] = 'Ingresá el costo sin IVA (0 si no lo sabés).';
    if (int.tryParse(_stock.text.trim()) == null) _errores['stockInicial'] = 'El stock inicial debe ser un entero.';
    if (int.tryParse(_seguridad.text.trim()) == null) _errores['stockSeguridad'] = 'El stock de seguridad debe ser un entero.';
    setState(() {});
    return _errores.isEmpty;
  }

  Future<void> _guardar() async {
    if (!_validar()) return;
    setState(() {
      _error = null;
      _enviando = true;
    });
    final dto = ProductoCreate(
      codigo: _codigo.text.trim(),
      nombre: _nombre.text.trim(),
      precioVenta: _monto(_precio.text)!,
      costoReposicion: _monto(_costo.text)!,
      stockInicial: int.parse(_stock.text.trim()),
      stockSeguridad: int.parse(_seguridad.text.trim()),
    );
    try {
      await ref.read(dioProvider).post<Map<String, dynamic>>('/products', data: dto.toJson());
      ref.invalidate(inventarioProvider);
      ref.invalidate(dashboardProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Producto creado')));
      context.go(Rutas.inventario);
    } on DioException catch (e) {
      final error = ApiException.fromDio(e);
      final d = error.details;
      setState(() {
        if (d is Map) {
          for (final campo in ['codigo', 'nombre', 'precioVenta', 'costoReposicion', 'stockInicial', 'stockSeguridad']) {
            final m = error.detalleDe(campo);
            if (m != null) _errores[campo] = m;
          }
        }
        _error = error.message;
      });
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Nuevo producto'),
        leading: BackButton(onPressed: () => context.go(Rutas.inventario)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _campo(_codigo, 'Código', 'FA-220', _errores['codigo'], mayusculas: true),
            _campo(_nombre, 'Nombre', 'Filtro de aceite', _errores['nombre']),
            _campo(_precio, 'Precio de venta (con IVA)', '3990', _errores['precioVenta'], numero: true),
            _campo(_costo, 'Costo de reposición (sin IVA)', '2400', _errores['costoReposicion'], numero: true),
            Row(
              children: [
                Expanded(child: _campo(_stock, 'Stock inicial', '0', _errores['stockInicial'], entero: true)),
                const SizedBox(width: 12),
                Expanded(child: _campo(_seguridad, 'Stock de seguridad', '0', _errores['stockSeguridad'], entero: true)),
              ],
            ),
            if (_error != null) ...[
              Aviso(_error!, tono: TonoAviso.error),
              const SizedBox(height: 12),
            ],
            FilledButton(onPressed: _enviando ? null : _guardar, child: const Text('Guardar producto')),
            const SizedBox(height: 8),
            TextButton(onPressed: _enviando ? null : () => context.go(Rutas.inventario), child: const Text('Cancelar')),
          ],
        ),
      ),
    );
  }

  Widget _campo(
    TextEditingController c,
    String etiqueta,
    String pista,
    String? error, {
    bool numero = false,
    bool entero = false,
    bool mayusculas = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: c,
        keyboardType: entero
            ? TextInputType.number
            : numero
                ? const TextInputType.numberWithOptions(decimal: true)
                : TextInputType.text,
        inputFormatters: entero ? [FilteringTextInputFormatter.digitsOnly] : null,
        textCapitalization: mayusculas ? TextCapitalization.characters : TextCapitalization.sentences,
        decoration: InputDecoration(labelText: etiqueta, hintText: pista, errorText: error),
      ),
    );
  }
}
