import 'dashboard.dart' show ProductoRef;

/// Producto del catálogo (HU-01). `costoReposicion` falta en las respuestas a EMPLEADO (CP-11.4b).

const estadosStock = ['SIN_STOCK', 'BAJO', 'OK'];

const etiquetaEstadoStock = <String, String>{
  'OK': 'OK',
  'BAJO': 'Bajo',
  'SIN_STOCK': 'Sin stock',
};

class Producto {
  const Producto({
    required this.id,
    required this.codigo,
    required this.nombre,
    required this.categoria,
    required this.precioVenta,
    required this.alicuotaIva,
    required this.costoReposicion,
    required this.stockActual,
    required this.stockSeguridad,
    required this.estadoStock,
    required this.proveedorPrincipal,
    required this.activo,
    required this.creadoEn,
    required this.actualizadoEn,
  });

  final String id;
  final String codigo;
  final String nombre;
  final String? categoria;
  final String precioVenta;
  final String alicuotaIva;

  /// null cuando la API lo ocultó (EMPLEADO).
  final String? costoReposicion;
  final int stockActual;
  final int stockSeguridad;
  final String estadoStock;
  final ProductoRef? proveedorPrincipal;
  final bool activo;
  final String creadoEn;
  final String actualizadoEn;

  ProductoRef get ref => ProductoRef(id: id, codigo: codigo, nombre: nombre);

  factory Producto.fromJson(Map<String, dynamic> j) => Producto(
        id: j['id'] as String,
        codigo: j['codigo'] as String,
        nombre: j['nombre'] as String,
        categoria: j['categoria'] as String?,
        precioVenta: j['precioVenta'] as String,
        alicuotaIva: j['alicuotaIva'] as String,
        costoReposicion: j['costoReposicion'] as String?,
        stockActual: j['stockActual'] as int,
        stockSeguridad: j['stockSeguridad'] as int,
        estadoStock: j['estadoStock'] as String,
        proveedorPrincipal: j['proveedorPrincipal'] == null
            ? null
            : ProductoRef(
                id: (j['proveedorPrincipal'] as Map<String, dynamic>)['id'] as String,
                codigo: '',
                nombre: (j['proveedorPrincipal'] as Map<String, dynamic>)['nombre'] as String,
              ),
        activo: j['activo'] as bool,
        creadoEn: j['creadoEn'] as String,
        actualizadoEn: j['actualizadoEn'] as String,
      );
}

/// Cuerpo de POST /api/v1/products (alta rápida, CP-M.3e).
class ProductoCreate {
  const ProductoCreate({
    required this.codigo,
    required this.nombre,
    required this.precioVenta,
    required this.costoReposicion,
    this.stockInicial = 0,
    this.stockSeguridad = 0,
    this.categoria,
    this.alicuotaIva,
  });

  final String codigo;
  final String nombre;
  final String precioVenta;
  final String costoReposicion;
  final int stockInicial;
  final int stockSeguridad;
  final String? categoria;
  final String? alicuotaIva;

  Map<String, dynamic> toJson() => {
        'codigo': codigo,
        'nombre': nombre,
        'precioVenta': precioVenta,
        'costoReposicion': costoReposicion,
        'stockInicial': stockInicial,
        'stockSeguridad': stockSeguridad,
        if (categoria != null && categoria!.isNotEmpty) 'categoria': categoria,
        if (alicuotaIva != null) 'alicuotaIva': alicuotaIva,
      };
}
