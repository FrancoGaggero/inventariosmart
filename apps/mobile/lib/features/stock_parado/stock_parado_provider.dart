import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/acumulado.dart';
import '../../core/api_client.dart';
import '../../core/auth/sesion.dart';
import '../../core/modelos/analisis.dart';

const _tamanioPagina = 25;

/// Días sin ventas: 30, 60, 90 o 180; 90 por defecto (design D4).
class PeriodoStockParadoNotifier extends Notifier<int> {
  @override
  int build() => 90;

  void elegir(int dias) => state = dias;
}

final periodoStockParadoProvider =
    NotifierProvider<PeriodoStockParadoNotifier, int>(PeriodoStockParadoNotifier.new);

Future<ResultadoStockParado> _pedir(Dio dio, int dias, {String? cursor}) async {
  try {
    final res = await dio.get<Map<String, dynamic>>(
      '/dead-stock',
      queryParameters: {'dias': dias, 'cursor': ?cursor, 'limit': _tamanioPagina},
    );
    return ResultadoStockParado.fromJson(res.data!);
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
}

/// Plata parada en productos sin ventas (HU-19); null sin plan PRO: no se consulta la API.
class StockParadoNotifier extends AsyncNotifier<Acumulado<ResultadoStockParado>?> {
  @override
  Future<Acumulado<ResultadoStockParado>?> build() async {
    final me = await ref.watch(meProvider.future);
    if (me == null || !me.tienePro) return null;
    return Acumulado(await _pedir(ref.watch(dioProvider), ref.watch(periodoStockParadoProvider)));
  }

  Future<void> cargarMas() async {
    final actual = state.value;
    if (actual == null || !actual.datos.hayMas || actual.cargandoMas) return;
    state = AsyncData(actual.cargando());
    try {
      final siguiente = await _pedir(ref.read(dioProvider), actual.datos.dias, cursor: actual.datos.siguienteCursor);
      state = AsyncData(Acumulado(actual.datos.conPagina(siguiente)));
    } catch (e) {
      state = AsyncData(actual.conError(mensajeDe(e)));
    }
  }
}

final stockParadoProvider =
    AsyncNotifierProvider<StockParadoNotifier, Acumulado<ResultadoStockParado>?>(StockParadoNotifier.new);
