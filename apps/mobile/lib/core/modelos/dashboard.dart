/// Respuesta de GET /api/v1/dashboard?periodo=YYYY-MM (HU-04, RN-01, RN-02).
library;

const etiquetaMotivoResumen = <String, String>{
  'SIN_GASTOS': 'No hay gastos cargados en el mes',
  'SIN_VENTAS': 'No hubo ventas en el mes',
};

class StockDashboard {
  const StockDashboard({
    required this.productosActivos,
    required this.unidades,
    required this.valorizacion,
    required this.sinStock,
    required this.stockBajo,
  });

  final int productosActivos;
  final int unidades;
  final String valorizacion;
  final int sinStock;
  final int stockBajo;

  factory StockDashboard.fromJson(Map<String, dynamic> j) => StockDashboard(
        productosActivos: j['productosActivos'] as int,
        unidades: j['unidades'] as int,
        valorizacion: j['valorizacion'] as String,
        sinStock: j['sinStock'] as int,
        stockBajo: j['stockBajo'] as int,
      );
}

class VentasDashboard {
  const VentasDashboard({
    required this.unidadesVendidas,
    required this.ventasNetas,
    required this.costoVendido,
    required this.margenBruto,
    required this.margenBrutoPct,
    required this.gastos,
    required this.margenNeto,
    required this.margenNetoPct,
    required this.motivo,
  });

  final int unidadesVendidas;
  final String ventasNetas;
  final String costoVendido;
  final String margenBruto;
  final String? margenBrutoPct;
  final String gastos;
  final String? margenNeto;
  final String? margenNetoPct;

  /// SIN_GASTOS o SIN_VENTAS cuando el margen neto no es calculable.
  final String? motivo;

  bool get margenNetoCalculable => margenNeto != null;

  factory VentasDashboard.fromJson(Map<String, dynamic> j) => VentasDashboard(
        unidadesVendidas: j['unidadesVendidas'] as int,
        ventasNetas: j['ventasNetas'] as String,
        costoVendido: j['costoVendido'] as String,
        margenBruto: j['margenBruto'] as String,
        margenBrutoPct: j['margenBrutoPct'] as String?,
        gastos: j['gastos'] as String,
        margenNeto: j['margenNeto'] as String?,
        margenNetoPct: j['margenNetoPct'] as String?,
        motivo: j['motivo'] as String?,
      );
}

class MesAnteriorDashboard {
  const MesAnteriorDashboard({
    required this.periodo,
    required this.unidadesVendidas,
    required this.ventasNetas,
    required this.variacionVentasPct,
  });

  final String periodo;
  final int unidadesVendidas;
  final String ventasNetas;
  final String? variacionVentasPct;

  factory MesAnteriorDashboard.fromJson(Map<String, dynamic> j) => MesAnteriorDashboard(
        periodo: j['periodo'] as String,
        unidadesVendidas: j['unidadesVendidas'] as int,
        ventasNetas: j['ventasNetas'] as String,
        variacionVentasPct: j['variacionVentasPct'] as String?,
      );
}

class ProductoRef {
  const ProductoRef({required this.id, required this.codigo, required this.nombre});

  final String id;
  final String codigo;
  final String nombre;

  factory ProductoRef.fromJson(Map<String, dynamic> j) =>
      ProductoRef(id: j['id'] as String, codigo: j['codigo'] as String, nombre: j['nombre'] as String);
}

class TopRentable {
  const TopRentable({
    required this.producto,
    required this.unidadesVendidas,
    required this.margenBruto,
    required this.margenBrutoPct,
    required this.margenBrutoMes,
  });

  final ProductoRef producto;
  final int unidadesVendidas;
  final String margenBruto;
  final String? margenBrutoPct;
  final String margenBrutoMes;

  factory TopRentable.fromJson(Map<String, dynamic> j) => TopRentable(
        producto: ProductoRef.fromJson(j['producto'] as Map<String, dynamic>),
        unidadesVendidas: j['unidadesVendidas'] as int,
        margenBruto: j['margenBruto'] as String,
        margenBrutoPct: j['margenBrutoPct'] as String?,
        margenBrutoMes: j['margenBrutoMes'] as String,
      );
}

class AlertaStock {
  const AlertaStock({
    required this.id,
    required this.codigo,
    required this.nombre,
    required this.stockActual,
    required this.stockSeguridad,
  });

  final String id;
  final String codigo;
  final String nombre;
  final int stockActual;
  final int stockSeguridad;

  factory AlertaStock.fromJson(Map<String, dynamic> j) => AlertaStock(
        id: j['id'] as String,
        codigo: j['codigo'] as String,
        nombre: j['nombre'] as String,
        stockActual: j['stockActual'] as int,
        stockSeguridad: j['stockSeguridad'] as int,
      );
}

class GrupoAlertas {
  const GrupoAlertas({required this.total, required this.items});

  final int total;
  final List<AlertaStock> items;

  factory GrupoAlertas.fromJson(Map<String, dynamic> j) => GrupoAlertas(
        total: j['total'] as int,
        items: (j['items'] as List<dynamic>)
            .map((e) => AlertaStock.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
      );
}

class AlertasDashboard {
  const AlertasDashboard({required this.sinStock, required this.stockBajo, required this.faltanGastos});

  final GrupoAlertas sinStock;
  final GrupoAlertas stockBajo;
  final bool faltanGastos;

  factory AlertasDashboard.fromJson(Map<String, dynamic> j) => AlertasDashboard(
        sinStock: GrupoAlertas.fromJson(j['sinStock'] as Map<String, dynamic>),
        stockBajo: GrupoAlertas.fromJson(j['stockBajo'] as Map<String, dynamic>),
        faltanGastos: j['faltanGastos'] as bool,
      );
}

class Dashboard {
  const Dashboard({
    required this.periodo,
    required this.stock,
    required this.ventas,
    required this.mesAnterior,
    required this.topRentables,
    required this.alertas,
  });

  final String periodo;
  final StockDashboard stock;
  final VentasDashboard ventas;
  final MesAnteriorDashboard mesAnterior;
  final List<TopRentable> topRentables;
  final AlertasDashboard alertas;

  factory Dashboard.fromJson(Map<String, dynamic> j) => Dashboard(
        periodo: j['periodo'] as String,
        stock: StockDashboard.fromJson(j['stock'] as Map<String, dynamic>),
        ventas: VentasDashboard.fromJson(j['ventas'] as Map<String, dynamic>),
        mesAnterior: MesAnteriorDashboard.fromJson(j['mesAnterior'] as Map<String, dynamic>),
        topRentables: (j['topRentables'] as List<dynamic>)
            .map((e) => TopRentable.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
        alertas: AlertasDashboard.fromJson(j['alertas'] as Map<String, dynamic>),
      );
}
