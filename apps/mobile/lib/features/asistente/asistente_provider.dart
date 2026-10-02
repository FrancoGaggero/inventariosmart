import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/acumulado.dart';
import '../../core/api_client.dart';
import '../../core/asistente_formato.dart';
import '../../core/auth/sesion.dart';
import '../../core/lista_paginada.dart';
import '../../core/modelos/asistente.dart';

/// Una respuesta puede hacer hasta siete llamadas al modelo de 30 s cada una (design D4).
const tiempoDeRespuesta = Duration(minutes: 3);

const _tamanioPagina = 25;

class EstadoChat {
  const EstadoChat({
    this.conversacionId,
    this.mensajes = const [],
    this.enviando = false,
    this.pendiente,
    this.aviso,
    this.borrador = '',
    this.abriendo = false,
    this.errorAlAbrir,
  });

  final String? conversacionId;
  final List<MensajeAsistente> mensajes;
  final bool enviando;

  /// La pregunta en camino, que se dibuja mientras se espera la respuesta.
  final String? pendiente;
  final AvisoAsistente? aviso;

  /// Texto del campo: un error no lo pierde (CP-M.12h, CP-M.12i).
  final String borrador;
  final bool abriendo;
  final Object? errorAlAbrir;

  bool get vacio => mensajes.isEmpty && pendiente == null;
}

/// Conversación en pantalla (design D3). No es autoDispose: el chat sigue al ir y volver de "Más",
/// y una respuesta en camino llega aunque se cambie de pestaña.
class ChatNotifier extends Notifier<EstadoChat> {
  @override
  EstadoChat build() {
    // Otra persona que inicia sesión en el mismo celular arranca con el chat vacío.
    ref.watch(sesionProvider.select((s) => s.value?.uid));
    return const EstadoChat();
  }

  void escribir(String texto) => state = EstadoChat(
        conversacionId: state.conversacionId,
        mensajes: state.mensajes,
        enviando: state.enviando,
        pendiente: state.pendiente,
        aviso: state.aviso,
        borrador: texto,
        abriendo: state.abriendo,
        errorAlAbrir: state.errorAlAbrir,
      );

  Future<void> enviar(String texto) async {
    if (!puedeEnviar(texto, state.enviando || state.abriendo)) return;
    final antes = state;
    final pregunta = texto.trim();
    state = EstadoChat(
      conversacionId: antes.conversacionId,
      mensajes: antes.mensajes,
      enviando: true,
      pendiente: pregunta,
      borrador: '',
    );
    try {
      final res = await ref.read(dioProvider).post<Map<String, dynamic>>(
            '/assistant/messages',
            data: {'conversacionId': ?antes.conversacionId, 'mensaje': pregunta},
            options: Options(receiveTimeout: tiempoDeRespuesta, extra: {sinAvisoDespertar: true}),
          );
      final r = RespuestaAsistente.fromJson(res.data!);
      // La API devuelve sólo la respuesta: la pregunta se arma acá.
      final propia = MensajeAsistente(
        id: 'local-${r.mensaje.id}',
        rol: 'USUARIO',
        contenido: pregunta,
        creadoEn: r.mensaje.creadoEn,
      );
      state = EstadoChat(conversacionId: r.conversacionId, mensajes: [...antes.mensajes, propia, r.mensaje]);
      ref.invalidate(conversacionesProvider);
    } catch (e) {
      final error = comoApiException(e);
      state = EstadoChat(
        conversacionId: antes.conversacionId,
        mensajes: antes.mensajes,
        aviso: avisoDeError(error.status, error.message),
        borrador: texto,
      );
    }
  }

  /// Carga una conversación anterior para seguirla (CP-M.12f).
  Future<void> abrir(String id) async {
    if (state.enviando) return;
    final borrador = state.borrador;
    state = EstadoChat(conversacionId: id, abriendo: true, borrador: borrador);
    try {
      final res = await ref.read(dioProvider).get<Map<String, dynamic>>('/assistant/conversations/$id');
      final c = ConversacionDetalle.fromJson(res.data!);
      state = EstadoChat(conversacionId: c.id, mensajes: c.mensajes, borrador: borrador);
    } catch (e) {
      state = EstadoChat(conversacionId: id, errorAlAbrir: comoApiException(e), borrador: borrador);
    }
  }

  /// Empieza de cero; conserva lo que estaba escrito (CP-M.12g).
  void nueva() {
    if (state.enviando) return;
    state = EstadoChat(borrador: state.borrador);
  }
}

final chatProvider = NotifierProvider<ChatNotifier, EstadoChat>(ChatNotifier.new);

Future<ListaPaginada<ConversacionResumen>> _pedirConversaciones(Dio dio, {String? cursor}) async {
  try {
    final res = await dio.get<Map<String, dynamic>>(
      '/assistant/conversations',
      queryParameters: {'cursor': ?cursor, 'limit': _tamanioPagina},
    );
    return ListaPaginada.fromJson(res.data!, ConversacionResumen.fromJson);
  } on DioException catch (e) {
    throw ApiException.fromDio(e);
  }
}

/// Conversaciones del dueño, de la más reciente a la más antigua; null sin PREMIUM.
class ConversacionesNotifier extends AsyncNotifier<Acumulado<ListaPaginada<ConversacionResumen>>?> {
  @override
  Future<Acumulado<ListaPaginada<ConversacionResumen>>?> build() async {
    final me = await ref.watch(meProvider.future);
    if (me == null || !me.usaAsistente || !me.tienePremium) return null;
    return Acumulado(await _pedirConversaciones(ref.watch(dioProvider)));
  }

  Future<void> cargarMas() async {
    final actual = state.value;
    if (actual == null || !actual.datos.hayMas || actual.cargandoMas) return;
    state = AsyncData(actual.cargando());
    try {
      final siguiente = await _pedirConversaciones(ref.read(dioProvider), cursor: actual.datos.siguienteCursor);
      state = AsyncData(Acumulado(ListaPaginada(
        items: [...actual.datos.items, ...siguiente.items],
        siguienteCursor: siguiente.siguienteCursor,
      )));
    } catch (e) {
      state = AsyncData(actual.conError(mensajeDe(e)));
    }
  }
}

final conversacionesProvider =
    AsyncNotifierProvider<ConversacionesNotifier, Acumulado<ListaPaginada<ConversacionResumen>>?>(
  ConversacionesNotifier.new,
);
