import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/acumulado.dart';
import '../../core/api_client.dart';
import '../../core/auth/sesion.dart';
import '../../core/lista_paginada.dart';
import '../../core/modelos/ordenes.dart';
import '../alertas/alertas_provider.dart';
import '../inicio/inicio_screen.dart';

const _tamanioPagina = 25;

/// Filtro del listado: TODAS por defecto (design D3 de mobile-orders).
class FiltroOrdenesNotifier extends Notifier<String> {
  @override
  String build() => 'TODAS';

  void elegir(String filtro) => state = filtro;
}

final filtroOrdenesProvider = NotifierProvider<FiltroOrdenesNotifier, String>(FiltroOrdenesNotifier.new);

Future<ListaPaginada<OrdenResumen>> _pedirPagina(Dio dio, String estado, {String? cursor}) async {
  try {
    final res = await dio.get<Map<String, dynamic>>(
      '/purchase-orders',
      queryParameters: {'estado': estado, 'cursor': ?cursor, 'limit': _tamanioPagina},
    );
    return ListaPaginada.fromJson(res.data!, OrdenResumen.fromJson);
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
}

/// Órdenes del filtro elegido; null sin plan PRO: no se consulta la API (CP-M.13k).
class OrdenesNotifier extends AsyncNotifier<Acumulado<ListaPaginada<OrdenResumen>>?> {
  @override
  Future<Acumulado<ListaPaginada<OrdenResumen>>?> build() async {
    final me = await ref.watch(meProvider.future);
    if (me == null || !me.tienePro) return null;
    return Acumulado(await _pedirPagina(ref.watch(dioProvider), ref.watch(filtroOrdenesProvider)));
  }

  Future<void> cargarMas() async {
    final actual = state.value;
    if (actual == null || !actual.datos.hayMas || actual.cargandoMas) return;
    state = AsyncData(actual.cargando());
    try {
      final siguiente = await _pedirPagina(
        ref.read(dioProvider),
        ref.read(filtroOrdenesProvider),
        cursor: actual.datos.siguienteCursor,
      );
      state = AsyncData(Acumulado(ListaPaginada(
        items: [...actual.datos.items, ...siguiente.items],
        siguienteCursor: siguiente.siguienteCursor,
      )));
    } catch (e) {
      state = AsyncData(actual.conError(mensajeDe(e)));
    }
  }
}

final ordenesProvider =
    AsyncNotifierProvider<OrdenesNotifier, Acumulado<ListaPaginada<OrdenResumen>>?>(OrdenesNotifier.new);

/// Detalle; null sin plan PRO.
final ordenProvider = FutureProvider.autoDispose.family<OrdenCompra?, String>((ref, id) async {
  final me = await ref.watch(meProvider.future);
  if (me == null || !me.tienePro) return null;
  try {
    final res = await ref.watch(dioProvider).get<Map<String, dynamic>>('/purchase-orders/$id');
    return OrdenCompra.fromJson(res.data!);
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
});

/// Una línea para guardar el borrador (PATCH reemplaza la lista).
typedef LineaPedida = ({String productoId, int cantidad, String? alertaId});

/// Acciones del DUENIO sobre una orden (RN-06). Cada una devuelve la orden nueva o lanza
/// [ApiException]; en los dos casos refresca lo que depende de ella (CP-M.13j).
class AccionesOrden {
  AccionesOrden(this._ref);

  final Ref _ref;

  Future<OrdenCompra> _correr(String id, Future<Response<Map<String, dynamic>>> Function(Dio dio) pedido) async {
    try {
      final res = await pedido(_ref.read(dioProvider));
      return OrdenCompra.fromJson(res.data!);
    } on DioException catch (e) {
      throw ApiException.fromDio(e);
    } finally {
      _ref.invalidate(ordenProvider(id));
      _ref.invalidate(ordenesProvider);
      // Confirmar atiende las alertas de los productos de la orden.
      _ref.invalidate(alertasProvider);
      _ref.invalidate(resumenAlertasProvider);
      _ref.invalidate(dashboardProvider);
    }
  }

  Future<OrdenCompra> guardar(String id, List<LineaPedida> lineas) => _correr(
        id,
        (dio) => dio.patch('/purchase-orders/$id', data: {
          'items': [
            for (final l in lineas) {'productoId': l.productoId, 'cantidad': l.cantidad, 'alertaId': ?l.alertaId},
          ],
        }),
      );

  /// [canal] sólo si el dueño lo eligió a mano (CP-M.13f); si no, la API usa el del proveedor.
  Future<OrdenCompra> confirmar(String id, {String? canal}) =>
      _correr(id, (dio) => dio.post('/purchase-orders/$id/confirm', data: {'canal': ?canal}));

  Future<OrdenCompra> marcarEnviada(String id) => _correr(id, (dio) => dio.post('/purchase-orders/$id/mark-sent'));

  Future<OrdenCompra> cancelar(String id) => _correr(id, (dio) => dio.post('/purchase-orders/$id/cancel'));
}

final accionesOrdenProvider = Provider<AccionesOrden>(AccionesOrden.new);
