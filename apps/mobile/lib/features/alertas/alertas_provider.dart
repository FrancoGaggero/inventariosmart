import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/acumulado.dart';
import '../../core/api_client.dart';
import '../../core/auth/sesion.dart';
import '../../core/lista_paginada.dart';
import '../../core/modelos/analisis.dart';
import '../inicio/inicio_screen.dart';

const _tamanioPagina = 25;

/// Filtro de la lista: ACTIVA, POSPUESTA o TODAS (design D4).
class FiltroAlertasNotifier extends Notifier<String> {
  @override
  String build() => 'ACTIVA';

  void elegir(String filtro) => state = filtro;
}

final filtroAlertasProvider = NotifierProvider<FiltroAlertasNotifier, String>(FiltroAlertasNotifier.new);

Future<ListaPaginada<Alerta>> _pedirPagina(Dio dio, String estado, {String? cursor}) async {
  try {
    final res = await dio.get<Map<String, dynamic>>(
      '/alerts',
      queryParameters: {'estado': estado, 'cursor': ?cursor, 'limit': _tamanioPagina},
    );
    return ListaPaginada.fromJson(res.data!, Alerta.fromJson);
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
}

/// Alertas del filtro elegido; null sin plan PRO: la pantalla muestra el aviso y no se consulta
/// la API (CP-M.9f).
class AlertasNotifier extends AsyncNotifier<Acumulado<ListaPaginada<Alerta>>?> {
  @override
  Future<Acumulado<ListaPaginada<Alerta>>?> build() async {
    final me = await ref.watch(meProvider.future);
    if (me == null || !me.tienePro) return null;
    final filtro = ref.watch(filtroAlertasProvider);
    return Acumulado(await _pedirPagina(ref.watch(dioProvider), filtro));
  }

  Future<void> cargarMas() async {
    final actual = state.value;
    if (actual == null || !actual.datos.hayMas || actual.cargandoMas) return;
    state = AsyncData(actual.cargando());
    try {
      final siguiente = await _pedirPagina(
        ref.read(dioProvider),
        ref.read(filtroAlertasProvider),
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

  /// ATENDER o POSPONER (CP-M.9b). Devuelve el error de la API, o null si salió bien. En los dos
  /// casos vuelve a cargar: si otra persona ya la cerró, la lista queda al día (CP-M.9g).
  Future<ApiException?> actuar(String id, String accion) async {
    ApiException? error;
    try {
      await ref.read(dioProvider).patch<Map<String, dynamic>>('/alerts/$id', data: {'accion': accion});
    } on DioException catch (e) {
      error = ApiException.fromDio(e);
    }
    ref.invalidateSelf();
    ref.invalidate(resumenAlertasProvider);
    ref.invalidate(dashboardProvider);
    return error;
  }
}

final alertasProvider =
    AsyncNotifierProvider<AlertasNotifier, Acumulado<ListaPaginada<Alerta>>?>(AlertasNotifier.new);

/// GET /alerts/summary para la frase de la cabecera; null sin plan PRO.
final resumenAlertasProvider = FutureProvider.autoDispose<ResumenAlertas?>((ref) async {
  final me = await ref.watch(meProvider.future);
  if (me == null || !me.tienePro) return null;
  try {
    final res = await ref.watch(dioProvider).get<Map<String, dynamic>>('/alerts/summary');
    return ResumenAlertas.fromJson(res.data!);
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
});
