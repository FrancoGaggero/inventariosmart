import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/acumulado.dart';
import '../../core/api_client.dart';
import '../../core/auth/sesion.dart';
import '../../core/modelos/analisis.dart';

const _tamanioPagina = 25;

/// Período de la consulta: 30, 60 o 90 días; 30 por defecto (design D4).
class PeriodoQuiebresNotifier extends Notifier<int> {
  @override
  int build() => 30;

  void elegir(int dias) => state = dias;
}

final periodoQuiebresProvider = NotifierProvider<PeriodoQuiebresNotifier, int>(PeriodoQuiebresNotifier.new);

Future<ResultadoQuiebres> _pedir(Dio dio, int dias, {String? cursor}) async {
  try {
    final res = await dio.get<Map<String, dynamic>>(
      '/stockouts',
      queryParameters: {'dias': dias, 'cursor': ?cursor, 'limit': _tamanioPagina},
    );
    return ResultadoQuiebres.fromJson(res.data!);
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
}

/// Pérdidas por falta de stock (HU-18); null sin plan PRO: no se consulta la API (CP-M.10g).
class QuiebresNotifier extends AsyncNotifier<Acumulado<ResultadoQuiebres>?> {
  @override
  Future<Acumulado<ResultadoQuiebres>?> build() async {
    final me = await ref.watch(meProvider.future);
    if (me == null || !me.tienePro) return null;
    return Acumulado(await _pedir(ref.watch(dioProvider), ref.watch(periodoQuiebresProvider)));
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

final quiebresProvider =
    AsyncNotifierProvider<QuiebresNotifier, Acumulado<ResultadoQuiebres>?>(QuiebresNotifier.new);
