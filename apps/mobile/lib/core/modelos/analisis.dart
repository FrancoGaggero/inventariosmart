/// Alertas de reposición (HU-06), falta de stock (HU-18) y stock parado (HU-19): respuestas de
/// `GET /alerts`, `/alerts/summary`, `/stockouts` y `/dead-stock` (design D3).
library;

import 'dashboard.dart';

/// Filtros de la pantalla de alertas (D7): Atendidas y Resueltas quedan dentro de "Todas".
const filtrosAlertas = ['ACTIVA', 'POSPUESTA', 'TODAS'];

const diasQuiebres = [30, 60, 90];
const diasStockParado = [30, 60, 90, 180];

class ProductoAlerta {
  const ProductoAlerta({
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

  factory ProductoAlerta.fromJson(Map<String, dynamic> j) => ProductoAlerta(
        id: j['id'] as String,
        codigo: j['codigo'] as String,
        nombre: j['nombre'] as String,
        stockActual: j['stockActual'] as int,
        stockSeguridad: j['stockSeguridad'] as int,
      );
}

class ProveedorAlerta {
  const ProveedorAlerta({required this.nombre, required this.leadTimeDias});

  final String nombre;
  final int leadTimeDias;

  factory ProveedorAlerta.fromJson(Map<String, dynamic> j) =>
      ProveedorAlerta(nombre: j['nombre'] as String, leadTimeDias: j['leadTimeDias'] as int);
}

class Alerta {
  const Alerta({
    required this.id,
    required this.producto,
    required this.proveedor,
    required this.estado,
    required this.severidad,
    required this.leadTimeDias,
    required this.velocidadDiaria,
    required this.diasCobertura,
    required this.cantidadSugerida,
    required this.pospuestaHasta,
  });

  final String id;
  final ProductoAlerta producto;
  final ProveedorAlerta? proveedor;

  /// ACTIVA, POSPUESTA, ATENDIDA o RESUELTA.
  final String estado;

  /// CRITICA o PROXIMA.
  final String severidad;
  final int leadTimeDias;

  /// Decimal como string, p. ej. "2.000".
  final String velocidadDiaria;
  final int? diasCobertura;
  final int cantidadSugerida;
  final String? pospuestaHasta;

  bool get abierta => estado == 'ACTIVA' || estado == 'POSPUESTA';

  factory Alerta.fromJson(Map<String, dynamic> j) => Alerta(
        id: j['id'] as String,
        producto: ProductoAlerta.fromJson(j['producto'] as Map<String, dynamic>),
        proveedor: j['proveedor'] == null ? null : ProveedorAlerta.fromJson(j['proveedor'] as Map<String, dynamic>),
        estado: j['estado'] as String,
        severidad: j['severidad'] as String,
        leadTimeDias: j['leadTimeDias'] as int,
        velocidadDiaria: j['velocidadDiaria'] as String,
        diasCobertura: j['diasCobertura'] as int?,
        cantidadSugerida: j['cantidadSugerida'] as int,
        pospuestaHasta: j['pospuestaHasta'] as String?,
      );
}

class ResumenAlertas {
  const ResumenAlertas({required this.activas, required this.criticas, required this.pospuestas, required this.calculadasEn});

  final int activas;
  final int criticas;
  final int pospuestas;
  final String? calculadasEn;

  factory ResumenAlertas.fromJson(Map<String, dynamic> j) => ResumenAlertas(
        activas: j['activas'] as int,
        criticas: j['criticas'] as int,
        pospuestas: j['pospuestas'] as int,
        calculadasEn: j['calculadasEn'] as String?,
      );
}

class TotalesQuiebres {
  const TotalesQuiebres({
    required this.gananciaPerdida,
    required this.ventaPerdida,
    required this.unidadesPerdidas,
    required this.productosAfectados,
    required this.enCurso,
  });

  final String gananciaPerdida;
  final String ventaPerdida;
  final String unidadesPerdidas;
  final int productosAfectados;
  final int enCurso;

  factory TotalesQuiebres.fromJson(Map<String, dynamic> j) => TotalesQuiebres(
        gananciaPerdida: j['gananciaPerdida'] as String,
        ventaPerdida: j['ventaPerdida'] as String,
        unidadesPerdidas: j['unidadesPerdidas'] as String,
        productosAfectados: j['productosAfectados'] as int,
        enCurso: j['enCurso'] as int,
      );
}

class ProductoConQuiebres {
  const ProductoConQuiebres({
    required this.producto,
    required this.quiebres,
    required this.diasSinStock,
    required this.enCurso,
    required this.demandaDiaria,
    required this.unidadesPerdidas,
    required this.gananciaPerdida,
    required this.motivo,
  });

  final ProductoRef producto;
  final int quiebres;
  final double diasSinStock;
  final bool enCurso;
  final String? demandaDiaria;
  final String? unidadesPerdidas;
  final String? gananciaPerdida;

  /// `SIN_HISTORIAL` cuando no se estima (RN-14); las cifras vienen en null.
  final String? motivo;

  factory ProductoConQuiebres.fromJson(Map<String, dynamic> j) => ProductoConQuiebres(
        producto: ProductoRef.fromJson(j['producto'] as Map<String, dynamic>),
        quiebres: j['quiebres'] as int,
        diasSinStock: (j['diasSinStock'] as num).toDouble(),
        enCurso: j['enCurso'] as bool,
        demandaDiaria: j['demandaDiaria'] as String?,
        unidadesPerdidas: j['unidadesPerdidas'] as String?,
        gananciaPerdida: j['gananciaPerdida'] as String?,
        motivo: j['motivo'] as String?,
      );
}

class ResultadoQuiebres {
  const ResultadoQuiebres({required this.dias, required this.totales, required this.items, required this.siguienteCursor});

  final int dias;
  final TotalesQuiebres totales;
  final List<ProductoConQuiebres> items;
  final String? siguienteCursor;

  bool get hayMas => siguienteCursor != null;

  /// Suma la página siguiente; los totales son del período completo y no cambian.
  ResultadoQuiebres conPagina(ResultadoQuiebres siguiente) => ResultadoQuiebres(
        dias: dias,
        totales: totales,
        items: [...items, ...siguiente.items],
        siguienteCursor: siguiente.siguienteCursor,
      );

  factory ResultadoQuiebres.fromJson(Map<String, dynamic> j) => ResultadoQuiebres(
        dias: j['dias'] as int,
        totales: TotalesQuiebres.fromJson(j['totales'] as Map<String, dynamic>),
        items: (j['items'] as List<dynamic>)
            .map((e) => ProductoConQuiebres.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
        siguienteCursor: j['siguienteCursor'] as String?,
      );
}

class TotalesStockParado {
  const TotalesStockParado({
    required this.capitalParado,
    required this.productos,
    required this.unidades,
    required this.porcentajeDelStock,
  });

  final String capitalParado;
  final int productos;
  final int unidades;
  final String? porcentajeDelStock;

  factory TotalesStockParado.fromJson(Map<String, dynamic> j) => TotalesStockParado(
        capitalParado: j['capitalParado'] as String,
        productos: j['productos'] as int,
        unidades: j['unidades'] as int,
        porcentajeDelStock: j['porcentajeDelStock'] as String?,
      );
}

class ProductoParado {
  const ProductoParado({
    required this.producto,
    required this.stock,
    required this.costoReposicion,
    required this.capitalParado,
    required this.ultimaVenta,
    required this.diasSinVender,
  });

  final ProductoRef producto;
  final int stock;
  final String costoReposicion;
  final String capitalParado;

  /// null si nunca se vendió.
  final String? ultimaVenta;
  final int diasSinVender;

  factory ProductoParado.fromJson(Map<String, dynamic> j) => ProductoParado(
        producto: ProductoRef.fromJson(j['producto'] as Map<String, dynamic>),
        stock: j['stock'] as int,
        costoReposicion: j['costoReposicion'] as String,
        capitalParado: j['capitalParado'] as String,
        ultimaVenta: j['ultimaVenta'] as String?,
        diasSinVender: j['diasSinVender'] as int,
      );
}

class ResultadoStockParado {
  const ResultadoStockParado({required this.dias, required this.totales, required this.items, required this.siguienteCursor});

  final int dias;
  final TotalesStockParado totales;
  final List<ProductoParado> items;
  final String? siguienteCursor;

  bool get hayMas => siguienteCursor != null;

  ResultadoStockParado conPagina(ResultadoStockParado siguiente) => ResultadoStockParado(
        dias: dias,
        totales: totales,
        items: [...items, ...siguiente.items],
        siguienteCursor: siguiente.siguienteCursor,
      );

  factory ResultadoStockParado.fromJson(Map<String, dynamic> j) => ResultadoStockParado(
        dias: j['dias'] as int,
        totales: TotalesStockParado.fromJson(j['totales'] as Map<String, dynamic>),
        items: (j['items'] as List<dynamic>)
            .map((e) => ProductoParado.fromJson(e as Map<String, dynamic>))
            .toList(growable: false),
        siguienteCursor: j['siguienteCursor'] as String?,
      );
}
