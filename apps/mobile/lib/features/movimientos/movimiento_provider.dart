import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/api_client.dart';
import '../../core/modelos/movimiento.dart';
import '../../core/modelos/producto.dart';
import '../inicio/inicio_screen.dart';
import '../inventario/inventario_provider.dart';

const _uuid = Uuid();

/// Estado del formulario de movimiento (D5): la clave de idempotencia se crea al enviar y se
/// conserva mientras el formulario no cambie (CP-M.4d).
class EstadoMovimiento {
  const EstadoMovimiento({
    this.tipo = 'VENTA',
    this.producto,
    this.cantidad = '',
    this.motivo,
    this.observacion = '',
    this.claveIdempotencia,
    this.enviando = false,
    this.error,
    this.errores = const {},
    this.resultado,
  });

  final String tipo;
  final Producto? producto;
  final String cantidad;
  final String? motivo;
  final String observacion;
  final String? claveIdempotencia;
  final bool enviando;
  final String? error;
  final Map<String, String> errores;

  /// Movimiento registrado en el último envío exitoso.
  final Movimiento? resultado;

  EstadoMovimiento copyWith({
    String? tipo,
    Producto? producto,
    bool limpiarProducto = false,
    String? cantidad,
    String? motivo,
    bool limpiarMotivo = false,
    String? observacion,
    String? claveIdempotencia,
    bool limpiarClave = false,
    bool? enviando,
    String? error,
    Map<String, String>? errores,
    Movimiento? resultado,
    bool limpiarResultado = false,
  }) =>
      EstadoMovimiento(
        tipo: tipo ?? this.tipo,
        producto: limpiarProducto ? null : (producto ?? this.producto),
        cantidad: cantidad ?? this.cantidad,
        motivo: limpiarMotivo ? null : (motivo ?? this.motivo),
        observacion: observacion ?? this.observacion,
        claveIdempotencia: limpiarClave ? null : (claveIdempotencia ?? this.claveIdempotencia),
        enviando: enviando ?? this.enviando,
        error: error,
        errores: errores ?? const {},
        resultado: limpiarResultado ? null : (resultado ?? this.resultado),
      );
}

class MovimientoNotifier extends Notifier<EstadoMovimiento> {
  @override
  EstadoMovimiento build() => const EstadoMovimiento();

  /// Cualquier edición invalida la clave de idempotencia y el resultado anterior.
  void _editar(EstadoMovimiento nuevo) => state = nuevo.copyWith(limpiarClave: true, limpiarResultado: true);

  void cambiarTipo(String tipo) => _editar(state.copyWith(tipo: tipo, limpiarMotivo: true));

  void elegirProducto(Producto? p) => _editar(p == null ? state.copyWith(limpiarProducto: true) : state.copyWith(producto: p));

  void cambiarCantidad(String c) => _editar(state.copyWith(cantidad: c));

  void cambiarMotivo(String? m) => _editar(m == null ? state.copyWith(limpiarMotivo: true) : state.copyWith(motivo: m));

  void cambiarObservacion(String o) => _editar(state.copyWith(observacion: o));

  /// "Registrar otro": conserva tipo y producto; limpia cantidad, motivo y observación.
  void otro() => state = EstadoMovimiento(tipo: state.tipo, producto: state.producto);

  void reiniciar() => state = const EstadoMovimiento();

  Map<String, String> _validar() {
    final e = <String, String>{};
    if (state.producto == null) e['productoId'] = 'Elegí un producto.';
    final n = int.tryParse(state.cantidad.trim());
    if (n == null) {
      e['cantidad'] = 'La cantidad debe ser un número entero.';
    } else if (state.tipo == 'AJUSTE' && n == 0) {
      e['cantidad'] = 'Indicá cuánto suma (positivo) o resta (negativo) el ajuste.';
    } else if (state.tipo != 'AJUSTE' && n <= 0) {
      e['cantidad'] = 'La cantidad debe ser mayor a 0.';
    }
    if (state.tipo == 'AJUSTE' && state.motivo == null) e['motivo'] = 'Elegí el motivo del ajuste.';
    if (state.observacion.length > 200) e['observacion'] = 'La observación no puede superar los 200 caracteres.';
    return e;
  }

  Future<void> enviar() async {
    if (state.enviando) return;
    final errores = _validar();
    if (errores.isNotEmpty) {
      state = state.copyWith(errores: errores);
      return;
    }
    final clave = state.claveIdempotencia ?? _uuid.v4();
    state = state.copyWith(enviando: true, claveIdempotencia: clave);
    final dto = MovimientoCreate(
      tipo: state.tipo,
      productoId: state.producto!.id,
      cantidad: int.parse(state.cantidad.trim()),
      motivo: state.motivo,
      observacion: state.observacion,
    );
    try {
      final res = await ref.read(dioProvider).post<Map<String, dynamic>>(
            '/movements',
            data: dto.toJson(),
            options: Options(headers: {'Idempotency-Key': clave}),
          );
      final movimiento = Movimiento.fromJson(res.data!);
      ref.invalidate(inventarioProvider);
      ref.invalidate(dashboardProvider);
      state = state.copyWith(enviando: false, resultado: movimiento, limpiarClave: true);
    } on DioException catch (e) {
      final error = ApiException.fromDio(e);
      final errores = <String, String>{};
      for (final campo in ['productoId', 'cantidad', 'motivo', 'observacion']) {
        final m = error.detalleDe(campo);
        if (m != null) errores[campo] = m;
      }
      // La clave se conserva: un reintento sin cambios no duplica la venta (CP-M.4d).
      state = state.copyWith(enviando: false, error: error.message, errores: errores);
    }
  }
}

final movimientoProvider = NotifierProvider<MovimientoNotifier, EstadoMovimiento>(MovimientoNotifier.new);
