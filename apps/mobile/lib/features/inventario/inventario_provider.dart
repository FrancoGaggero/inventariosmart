import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../core/lista_paginada.dart';
import '../../core/modelos/producto.dart';

const _tamanioPagina = 25;

/// Filtros del inventario de mostrador (CP-M.3).
class FiltrosInventario {
  const FiltrosInventario({this.q = '', this.estado});

  final String q;

  /// OK, BAJO, SIN_STOCK o null (todos).
  final String? estado;

  FiltrosInventario copyWith({String? q, String? estado, bool limpiarEstado = false}) =>
      FiltrosInventario(q: q ?? this.q, estado: limpiarEstado ? null : (estado ?? this.estado));

  Map<String, dynamic> aQuery({String? cursor}) => {
        if (q.trim().isNotEmpty) 'q': q.trim(),
        'estado': ?estado,
        'cursor': ?cursor,
        'limit': _tamanioPagina,
      };
}

class FiltrosInventarioNotifier extends Notifier<FiltrosInventario> {
  @override
  FiltrosInventario build() => const FiltrosInventario();

  void buscar(String q) => state = state.copyWith(q: q);

  void filtrarEstado(String? estado) => state = state.copyWith(estado: estado, limpiarEstado: estado == null);
}

final filtrosInventarioProvider =
    NotifierProvider<FiltrosInventarioNotifier, FiltrosInventario>(FiltrosInventarioNotifier.new);

/// Páginas acumuladas del inventario (CP-M.3b).
class PaginaInventario {
  const PaginaInventario({required this.items, required this.siguienteCursor, this.cargandoMas = false, this.errorMas});

  final List<Producto> items;
  final String? siguienteCursor;
  final bool cargandoMas;
  final String? errorMas;

  bool get hayMas => siguienteCursor != null;

  PaginaInventario copyWith({List<Producto>? items, String? siguienteCursor, bool? cargandoMas, String? errorMas, bool finDeLista = false}) =>
      PaginaInventario(
        items: items ?? this.items,
        siguienteCursor: finDeLista ? null : (siguienteCursor ?? this.siguienteCursor),
        cargandoMas: cargandoMas ?? this.cargandoMas,
        errorMas: errorMas,
      );
}

Future<ListaPaginada<Producto>> _pedirPagina(Dio dio, Map<String, dynamic> query) async {
  try {
    final res = await dio.get<Map<String, dynamic>>('/products', queryParameters: query);
    return ListaPaginada.fromJson(res.data!, Producto.fromJson);
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
}

class InventarioNotifier extends AsyncNotifier<PaginaInventario> {
  @override
  Future<PaginaInventario> build() async {
    final filtros = ref.watch(filtrosInventarioProvider);
    final pagina = await _pedirPagina(ref.watch(dioProvider), filtros.aQuery());
    return PaginaInventario(items: pagina.items, siguienteCursor: pagina.siguienteCursor);
  }

  /// Trae la página siguiente y la suma a la lista (CP-M.3b).
  Future<void> cargarMas() async {
    final actual = state.value;
    if (actual == null || !actual.hayMas || actual.cargandoMas) return;
    state = AsyncData(actual.copyWith(cargandoMas: true));
    try {
      final filtros = ref.read(filtrosInventarioProvider);
      final pagina = await _pedirPagina(ref.read(dioProvider), filtros.aQuery(cursor: actual.siguienteCursor));
      state = AsyncData(
        PaginaInventario(items: [...actual.items, ...pagina.items], siguienteCursor: pagina.siguienteCursor),
      );
    } catch (e) {
      state = AsyncData(actual.copyWith(cargandoMas: false, errorMas: mensajeDe(e)));
    }
  }
}

final inventarioProvider = AsyncNotifierProvider<InventarioNotifier, PaginaInventario>(InventarioNotifier.new);

/// Búsqueda corta para el selector de producto del formulario de movimiento.
final buscarProductosProvider = FutureProvider.autoDispose.family<List<Producto>, String>((ref, q) async {
  final pagina = await _pedirPagina(ref.watch(dioProvider), {if (q.trim().isNotEmpty) 'q': q.trim(), 'limit': 20});
  return pagina.items;
});

/// GET /products/:id (precarga de "Vender" desde el inventario, CP-M.4f).
final productoProvider = FutureProvider.autoDispose.family<Producto, String>((ref, id) async {
  try {
    final res = await ref.watch(dioProvider).get<Map<String, dynamic>>('/products/$id');
    return Producto.fromJson(res.data!);
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
});
