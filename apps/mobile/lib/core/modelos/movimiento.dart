import 'dashboard.dart' show ProductoRef;

/// Movimientos de stock (HU-10, RN-07). Copia de las constantes de `packages/shared`.

const tiposMovimiento = ['VENTA', 'INGRESO', 'AJUSTE'];

const etiquetaTipo = <String, String>{
  'VENTA': 'Venta',
  'INGRESO': 'Ingreso',
  'AJUSTE': 'Ajuste',
};

const etiquetaMotivo = <String, String>{
  'STOCK_INICIAL': 'Stock inicial',
  'COMPRA': 'Compra a proveedor',
  'DEVOLUCION': 'Devolución de cliente',
  'INVENTARIO': 'Conteo de inventario',
  'ROTURA': 'Rotura o daño',
  'VENCIMIENTO': 'Vencimiento',
  'ROBO': 'Robo o faltante',
  'USO_INTERNO': 'Uso interno',
  'ANULACION': 'Anulación',
  'OTRO': 'Otro',
};

const motivosIngreso = ['COMPRA', 'DEVOLUCION', 'OTRO'];
const motivosAjuste = ['INVENTARIO', 'ROTURA', 'VENCIMIENTO', 'ROBO', 'USO_INTERNO', 'OTRO'];

/// Motivos que puede elegir la persona para cada tipo (la VENTA no lleva motivo).
const motivosPorTipo = <String, List<String>>{
  'VENTA': [],
  'INGRESO': motivosIngreso,
  'AJUSTE': motivosAjuste,
};

class UsuarioRef {
  const UsuarioRef({required this.id, required this.nombre});

  final String id;
  final String? nombre;

  factory UsuarioRef.fromJson(Map<String, dynamic> j) =>
      UsuarioRef(id: j['id'] as String, nombre: j['nombre'] as String?);
}

class Movimiento {
  const Movimiento({
    required this.id,
    required this.tipo,
    required this.producto,
    required this.usuario,
    required this.cantidad,
    required this.efectoStock,
    required this.stockResultante,
    required this.estadoStock,
    required this.precioUnitario,
    required this.motivo,
    required this.observacion,
    required this.fecha,
    required this.corrigeAId,
    required this.anuladoPorId,
    required this.creadoEn,
  });

  final String id;
  final String tipo;
  final ProductoRef producto;
  final UsuarioRef usuario;
  final int cantidad;
  final int efectoStock;
  final int stockResultante;
  final String estadoStock;

  /// Precio unitario neto de la venta; null en ingresos y ajustes o si la API lo ocultó.
  final String? precioUnitario;
  final String? motivo;
  final String? observacion;
  final String fecha;
  final String? corrigeAId;
  final String? anuladoPorId;
  final String creadoEn;

  factory Movimiento.fromJson(Map<String, dynamic> j) => Movimiento(
        id: j['id'] as String,
        tipo: j['tipo'] as String,
        producto: ProductoRef.fromJson(j['producto'] as Map<String, dynamic>),
        usuario: UsuarioRef.fromJson(j['usuario'] as Map<String, dynamic>),
        cantidad: j['cantidad'] as int,
        efectoStock: j['efectoStock'] as int,
        stockResultante: j['stockResultante'] as int,
        estadoStock: j['estadoStock'] as String,
        precioUnitario: j['precioUnitario'] as String?,
        motivo: j['motivo'] as String?,
        observacion: j['observacion'] as String?,
        fecha: j['fecha'] as String,
        corrigeAId: j['corrigeAId'] as String?,
        anuladoPorId: j['anuladoPorId'] as String?,
        creadoEn: j['creadoEn'] as String,
      );
}

/// Cuerpo de POST /api/v1/movements, discriminado por tipo (CP-10.1).
/// La VENTA toma el precio vigente del producto; el motivo es obligatorio en el AJUSTE.
class MovimientoCreate {
  const MovimientoCreate({
    required this.tipo,
    required this.productoId,
    required this.cantidad,
    this.motivo,
    this.observacion,
  });

  final String tipo;
  final String productoId;
  final int cantidad;
  final String? motivo;
  final String? observacion;

  Map<String, dynamic> toJson() => {
        'tipo': tipo,
        'productoId': productoId,
        'cantidad': cantidad,
        if (tipo != 'VENTA' && motivo != null) 'motivo': motivo,
        if (observacion != null && observacion!.trim().isNotEmpty) 'observacion': observacion!.trim(),
      };
}
