import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:inventariosmart_mobile/core/api_client.dart';
import 'package:inventariosmart_mobile/core/auth/auth_repository.dart';

DioException _conRespuesta(int status, Object? data) {
  final req = RequestOptions(path: '/x');
  return DioException(
    requestOptions: req,
    response: Response(requestOptions: req, statusCode: status, data: data),
    type: DioExceptionType.badResponse,
  );
}

void main() {
  test('usa code y message del contrato de la API', () {
    final e = ApiException.fromDio(
      _conRespuesta(409, {
        'code': 'CONFLICTO',
        'message': 'Stock insuficiente: quedan 3 unidades.',
        'details': {'cantidad': 'Máximo 3.'},
      }),
    );
    expect(e.code, 'CONFLICTO');
    expect(e.message, 'Stock insuficiente: quedan 3 unidades.');
    expect(e.status, 409);
    expect(e.detalleDe('cantidad'), 'Máximo 3.');
    expect(e.esNoAutenticado, isFalse);
  });

  test('401 y 403 se reconocen (CP-M.1i)', () {
    expect(
      ApiException.fromDio(_conRespuesta(401, {'code': 'NO_AUTENTICADO', 'message': 'x'})).esNoAutenticado,
      isTrue,
    );
    expect(
      ApiException.fromDio(_conRespuesta(403, {'code': 'SIN_PERMISO', 'message': 'x'})).esSinPermiso,
      isTrue,
    );
  });

  test('sin respuesta es SIN_CONEXION con mensaje en español (CP-M.5)', () {
    final e = ApiException.fromDio(
      DioException(requestOptions: RequestOptions(path: '/x'), type: DioExceptionType.connectionError),
    );
    expect(e.sinConexion, isTrue);
    expect(e.message, 'No pudimos comunicarnos con el servidor. Revisá tu conexión e intentá de nuevo.');
    expect(mensajeDe(e), e.message);
  });

  test('respuesta sin cuerpo del contrato conserva el código HTTP', () {
    final e = ApiException.fromDio(_conRespuesta(502, '<html>Bad gateway</html>'));
    expect(e.code, 'HTTP_502');
    expect(e.status, 502);
  });

  test('mensajeFirebase traduce los códigos conocidos', () {
    expect(mensajeFirebase('invalid-credential'), 'El email o la contraseña no son correctos.');
    expect(mensajeFirebase('weak-password'), 'La contraseña tiene que tener al menos 8 caracteres.');
    expect(mensajeFirebase('google-sin-configurar'), contains('Google no está disponible'));
    expect(mensajeFirebase('algo-raro'), 'No pudimos completar la operación.');
  });
}
